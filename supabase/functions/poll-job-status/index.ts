import { createServiceClient } from '../_shared/db.ts'
import { decrypt } from '../_shared/encryption.ts'

Deno.serve(async (req: Request) => {
  // Cron-triggered: verify service role key in Authorization header
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!authHeader.includes(serviceRoleKey)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  const db = createServiceClient()
  let polled = 0, completed = 0, failed = 0

  try {
    const { data: jobs } = await db
      .from('generation_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .lt('poll_count', 60)

    for (const job of jobs ?? []) {
      polled++
      try {
        // Increment poll_count and mark processing
        const newPollCount = (job.poll_count ?? 0) + 1
        await db.from('generation_jobs')
          .update({ poll_count: newPollCount, status: 'processing' })
          .eq('id', job.id)

        // Check timeout first
        if (newPollCount >= 60) {
          await db.from('generation_jobs').update({
            status: 'failed',
            error_message: 'Generation timed out',
          }).eq('id', job.id)
          failed++
          continue
        }

        if (!job.openrouter_job_id) {
          // No external job ID means it wasn't properly started async — skip
          continue
        }

        // Resolve API key
        let apiKey = ''
        try {
          const { data: keyRow } = await db
            .from('org_provider_api_keys')
            .select('encrypted_key')
            .eq('org_id', job.org_id)
            .eq('provider_key', job.provider_key)
            .maybeSingle()
          if (keyRow?.encrypted_key) {
            apiKey = await decrypt(keyRow.encrypted_key)
          }
        } catch { /* ignore decrypt errors */ }

        if (!apiKey) {
          const platformKeys: Record<string, string> = {
            openrouter: 'OPENROUTER_DEFAULT_API_KEY',
            fal: 'FAL_API_KEY',
            google_ai_studio: 'GOOGLE_AI_STUDIO_API_KEY',
          }
          apiKey = Deno.env.get(platformKeys[job.provider_key] ?? '') ?? ''
        }

        if (!apiKey) {
          await db.from('generation_jobs').update({ status: 'failed', error_message: 'no_api_key' }).eq('id', job.id)
          failed++
          continue
        }

        let result: { status: string; outputUrl?: string; error?: string } = { status: 'pending' }

        if (job.provider_key === 'fal') {
          const { pollFalJob } = await import('../_shared/providers/fal.ts')
          try {
            const falResult = await pollFalJob(job.openrouter_job_id, apiKey)
            const imageUrl = falResult?.data?.images?.[0]?.url
            result = { status: imageUrl ? 'completed' : 'pending', outputUrl: imageUrl }
          } catch (e: any) {
            result = { status: 'failed', error: e.message }
          }
        } else if (job.provider_key === 'openrouter') {
          const { pollOpenRouterJob } = await import('../_shared/providers/openrouter.ts')
          result = await pollOpenRouterJob(job.openrouter_job_id, apiKey)
        } else if (job.provider_key === 'google_ai_studio') {
          const { pollGoogleVideoJob } = await import('../_shared/providers/google_ai_studio.ts')
          result = await pollGoogleVideoJob(job.openrouter_job_id, apiKey)
        } else {
          await db.from('generation_jobs').update({ status: 'failed', error_message: 'unsupported_provider' }).eq('id', job.id)
          failed++
          continue
        }

        if (result.status === 'completed' && result.outputUrl) {
          const startedAt = job.started_at ? new Date(job.started_at).getTime() : Date.now()
          const generationTimeMs = Date.now() - startedAt

          // Download asset bytes
          const assetRes = await fetch(result.outputUrl)
          const bytes = new Uint8Array(await assetRes.arrayBuffer())

          // Upload to storage
          const ext = job.asset_type === 'video' ? 'mp4' : 'png'
          const storagePath = `assets/${job.org_id}/${job.id}.${ext}`
          const contentType = ext === 'mp4' ? 'video/mp4' : 'image/png'

          await db.storage.from('assets').upload(storagePath, bytes, { contentType, upsert: true })

          await db.from('generation_jobs').update({
            status: 'completed',
            output_url: storagePath,
            completed_at: new Date().toISOString(),
            generation_time_ms: generationTimeMs,
          }).eq('id', job.id)

          // Broadcast via Realtime
          try {
            await db.channel(`job:${job.id}`).send({
              type: 'broadcast',
              event: 'job_complete',
              payload: { job_id: job.id, status: 'completed', output_url: storagePath },
            })
          } catch { /* ignore broadcast errors */ }

          completed++
        } else if (result.status === 'failed') {
          await db.from('generation_jobs').update({
            status: 'failed',
            error_message: result.error ?? 'generation_failed',
          }).eq('id', job.id)
          failed++
        }
      } catch (jobErr) {
        console.error(`poll-job-status error job ${job.id}:`, (jobErr as Error).message)
      }
    }
  } catch (err) {
    console.error('poll-job-status fatal error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 })
  }

  return new Response(
    JSON.stringify({ polled, completed, failed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
