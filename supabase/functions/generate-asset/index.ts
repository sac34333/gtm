import { validateJWT, requireRole } from '../_shared/auth.ts'
import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/db.ts'
import { resolveApiKey, routeGeneration, routeVideoGeneration } from '../_shared/providers/router.ts'

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp
  const corsHeaders = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const { user } = await validateJWT(req)
    const org_id = user.app_metadata?.org_id as string | undefined
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'no_org' }), { status: 401, headers: corsHeaders })
    }

    const db = createServiceClient()
    await requireRole(org_id, user.id, 'member', db)

    const contentLength = parseInt(req.headers.get('content-length') ?? '0')
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers: corsHeaders })
    }

    const body = await req.json()
    let { content_job, model_id, provider_key } = body

    if (!content_job || typeof content_job !== 'object') {
      return new Response(JSON.stringify({ error: 'content_job_required' }), { status: 400, headers: corsHeaders })
    }

    // Resolve model if not in request
    if (!model_id || !provider_key) {
      const assetType = content_job.asset_type ?? 'image'
      const stepKey = assetType === 'video' ? 'video_generation' : 'image_generation'

      const { data: pref } = await db
        .from('org_model_preferences')
        .select('model_id, provider_key')
        .eq('org_id', org_id)
        .eq('step_key', stepKey)
        .maybeSingle()

      if (pref) {
        model_id = pref.model_id
        provider_key = pref.provider_key
      } else {
        const { data: defaultModel } = await db
          .from('available_models')
          .select('model_id, provider_key')
          .contains('default_for_step_key', [stepKey])
          .eq('is_active', true)
          .maybeSingle()

        if (!defaultModel) {
          return new Response(JSON.stringify({ error: 'no_model_available' }), { status: 400, headers: corsHeaders })
        }
        model_id = defaultModel.model_id
        provider_key = defaultModel.provider_key
      }
    }

    // Fetch model row
    const { data: modelRow } = await db
      .from('available_models')
      .select('key_source, estimated_time_seconds, requires_paid_plan')
      .eq('model_id', model_id)
      .eq('provider_key', provider_key)
      .maybeSingle()

    // Quota check
    const { data: org } = await db
      .from('orgs')
      .select('plan_tier, image_used, image_quota, video_used, video_quota, slug')
      .eq('id', org_id)
      .single()

    const assetType = content_job.asset_type ?? 'image'
    if (assetType === 'image' && (org?.image_used ?? 0) >= (org?.image_quota ?? 50)) {
      return new Response(JSON.stringify({ error: 'quota_exceeded', quota_type: 'image' }), { status: 402, headers: corsHeaders })
    }
    if (assetType === 'video' && (org?.video_used ?? 0) >= (org?.video_quota ?? 5)) {
      return new Response(JSON.stringify({ error: 'quota_exceeded', quota_type: 'video' }), { status: 402, headers: corsHeaders })
    }

    // Plan tier check
    if (modelRow?.requires_paid_plan && org?.plan_tier === 'starter') {
      return new Response(JSON.stringify({ error: 'model_requires_paid_plan' }), { status: 403, headers: corsHeaders })
    }

    // Resolve API key
    const apiKey = await resolveApiKey(org_id, provider_key, modelRow?.key_source ?? 'user_or_platform')

    // Write generation_jobs row
    const { data: job, error: jobError } = await db
      .from('generation_jobs')
      .insert({
        org_id,
        created_by: user.id,
        step_key: assetType === 'video' ? 'video_generation' : 'image_generation',
        status: 'pending',
        model_id,
        provider_key,
        content_job_json: content_job,
        prompt_tags: content_job.prompt_tags ?? null,
        signal_id: content_job.signal_id ?? null,
        asset_type: assetType,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (jobError || !job) {
      console.error('generate-asset job insert error:', jobError?.code)
      return new Response(JSON.stringify({ error: 'job_create_failed' }), { status: 500, headers: corsHeaders })
    }

    const jobId = job.id

    // Increment quota
    if (assetType === 'image') {
      await db.from('orgs').update({ image_used: (org?.image_used ?? 0) + 1 }).eq('id', org_id)
    } else {
      await db.from('orgs').update({ video_used: (org?.video_used ?? 0) + 1 }).eq('id', org_id)
    }

    // Build payload for provider
    // Update stored content_job_json to include resolved job_id and org_slug
    await db.from('generation_jobs').update({
      content_job_json: {
        ...content_job,
        job_id: jobId,
        org_id,
        org_slug: org?.slug ?? content_job.org_slug ?? '',
        model_id,
        provider_key,
        asset_type: assetType,
      },
    }).eq('id', jobId)

    const providerPayload = {
      ...content_job,
      org_id,
      org_slug: org?.slug ?? content_job.org_slug ?? '',
      job_id: jobId,
      model_id,
      provider_key,
      asset_type: assetType,
      key_source_used: modelRow?.key_source ?? 'platform',
    }

    const startTime = Date.now()

    // Call provider — video always async, image can be sync or async
    let result: any
    try {
      if (assetType === 'video') {
        result = await routeVideoGeneration(provider_key, model_id, providerPayload, apiKey)
      } else {
        result = await routeGeneration(provider_key, model_id, providerPayload, apiKey)
      }
    } catch (providerErr) {
      if (providerErr instanceof Response) {
        await db.from('generation_jobs').update({ status: 'failed', error_message: 'provider_error' }).eq('id', jobId)
        return providerErr
      }
      const errMsg = providerErr instanceof Error ? providerErr.message : 'provider_error'
      await db.from('generation_jobs').update({ status: 'failed', error_message: errMsg }).eq('id', jobId)
      return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: corsHeaders })
    }

    const generationTimeMs = Date.now() - startTime
    const storagePath = `assets/${org_id}/${jobId}.${assetType === 'video' ? 'mp4' : 'png'}`

    // Synchronous completion — image models that return outputUrl immediately
    if (result.outputUrl && assetType === 'image') {
      await db.from('generation_jobs').update({
        status: 'completed',
        output_url: storagePath,
        completed_at: new Date().toISOString(),
        generation_time_ms: generationTimeMs,
      }).eq('id', jobId)

      return new Response(JSON.stringify({
        job_id: jobId,
        status: 'completed',
        output_url: result.outputUrl,
        storage_path: storagePath,
      }), { status: 200, headers: corsHeaders })
    }

    // Async — video or slow image model
    // Store the external job reference for poll-job-status to use
    const externalJobId = result.request_id ?? result.operationName ?? result.jobId ?? null
    if (externalJobId) {
      await db.from('generation_jobs').update({
        openrouter_job_id: externalJobId,
      }).eq('id', jobId)
    }

    // Video always returns pending
    if (assetType === 'video' || result.status === 'pending') {
      return new Response(JSON.stringify({
        job_id: jobId,
        status: 'pending',
      }), { status: 200, headers: corsHeaders })
    }

    // Unknown result shape
    await db.from('generation_jobs').update({ status: 'failed', error_message: 'unexpected_provider_response' }).eq('id', jobId)
    return new Response(JSON.stringify({ error: 'unexpected_provider_response' }), { status: 500, headers: corsHeaders })

  } catch (err) {
    if (err instanceof Response) return err
    console.error('generate-asset error')
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
