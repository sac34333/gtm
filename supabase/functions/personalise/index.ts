import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { resolveApiKey, routeTextGeneration, ProviderError, userMessageFor } from '../_shared/providers/router.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    // Validate body size
    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { prospect_id, job_id, platform = 'linkedin' } = body

    if (!prospect_id || typeof prospect_id !== 'string') {
      return new Response(JSON.stringify({ error: 'prospect_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!job_id || typeof job_id !== 'string') {
      return new Response(JSON.stringify({ error: 'job_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch prospect — verify org ownership
    const { data: prospect, error: prospectErr } = await db
      .from('prospects')
      .select('*')
      .eq('id', prospect_id)
      .eq('org_id', orgId)
      .single()

    if (prospectErr || !prospect) {
      return new Response(JSON.stringify({ error: 'prospect_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch generation job — verify org ownership
    const { data: job, error: jobErr } = await db
      .from('generation_jobs')
      .select('*')
      .eq('id', job_id)
      .eq('org_id', orgId)
      .single()

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'job_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch brand context
    const { data: brand } = await db
      .from('brand_contexts')
      .select('*')
      .eq('org_id', orgId)
      .single()

    if (!brand) {
      return new Response(JSON.stringify({ error: 'brand_context_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch org slug
    const { data: org } = await db
      .from('orgs')
      .select('slug')
      .eq('id', orgId)
      .single()
    const orgSlug = (org as any)?.slug ?? ''

    // Resolve text model for outreach_copy step
    let providerKey = 'openrouter'
    let modelId = 'deepseek/deepseek-v4-flash'

    const { data: modelPref } = await db
      .from('org_model_preferences')
      .select('provider_key, model_id')
      .eq('org_id', orgId)
      .eq('step_key', 'outreach_copy')
      .single()

    if (modelPref) {
      providerKey = modelPref.provider_key
      modelId = modelPref.model_id
    } else {
      // Fall back to available_models default for outreach_copy
      const { data: defaultModel } = await db
        .from('available_models')
        .select('provider_key, model_id')
        .contains('default_for_step_key', ['outreach_copy'])
        .eq('is_active', true)
        .maybeSingle()
      if (defaultModel) {
        providerKey = defaultModel.provider_key
        modelId = defaultModel.model_id
      }
    }

    const apiKey = await resolveApiKey(orgId, providerKey)

    // Build personalisation prompt
    const contentJob = job.content_job_json ?? {}
    const promptTags = job.prompt_tags ?? {}
    const voiceExamples: string[] = brand.voice_examples ?? []
    const competitorNames: string[] = brand.competitor_names ?? []

    const prompt = `You are writing a personalised B2B outreach message for ${brand.company_name} (brand).
Target platform: ${platform}

Brand voice:
- Tone: formal/conversational=${brand.tone_formal_conversational ?? 5}, bold/safe=${brand.tone_safe_bold ?? 5}
- Emoji usage: ${brand.emoji_usage ?? 'minimal'}
- CTA style: ${brand.cta_style ?? 'soft ask'}
${voiceExamples[0] ? `- Example voice: "${voiceExamples[0]}"` : ''}

The campaign is about: ${contentJob.signal_headline ?? promptTags.subject ?? 'a new campaign'}
Generated asset: ${job.asset_type ?? 'image'} titled "${promptTags.subject ?? 'campaign asset'}"

Prospect:
- Name: ${prospect.first_name ?? ''} ${prospect.last_name ?? ''}, ${prospect.job_title ?? 'professional'} at ${prospect.company_name ?? 'their company'}
- Company: ${prospect.company_name ?? ''} — ${prospect.company_description ?? 'a leading company in their space'}
- Industry: ${prospect.industry ?? 'technology'}, Size: ${prospect.company_size ?? 'unknown'}, Country: ${prospect.country ?? 'unknown'}

Write a personalised outreach message for ${platform}. Max 200 words.
Reference the prospect's company context. Reference the campaign asset.
Use the brand voice. End with the CTA style: ${brand.cta_style ?? 'soft ask'}.${competitorNames.length ? `\nDo NOT mention: ${competitorNames.join(', ')}` : ''}

Return only the outreach message text, no preamble.`

    const messages = [{ role: 'user', content: prompt }]

    const copyText = await routeTextGeneration(
      providerKey,
      modelId,
      messages,
      apiKey,
      orgId,
      orgSlug,
      job_id,
      'outreach_copy',
    )

    // INSERT into outreach_copies
    const { data: copy, error: copyErr } = await db
      .from('outreach_copies')
      .insert({
        org_id: orgId,
        prospect_id,
        job_id,
        platform,
        copy_text: copyText,
        status: 'draft',
        personalisation_data: {
          model_id: modelId,
          provider_key: providerKey,
          prompt_snapshot: prompt.slice(0, 500),
        },
      })
      .select('id, copy_text, status, platform')
      .single()

    if (copyErr || !copy) {
      console.error('outreach_copies insert failed:', copyErr?.message)
      return new Response(JSON.stringify({ error: 'failed_to_save_copy' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Auto-advance prospect lifecycle to 'contacted' on first outreach copy.
    // Don't downgrade prospects already at 'replied' / 'qualified' / 'disqualified'.
    //
    // Two-pass:
    //   1. Always stamp last_contacted_at + contacted_via='personal' (overwrites any
    //      prior 'campaign' attribution because this is a more recent personal touch).
    //      last_campaign_id is NOT cleared — we keep history of the last bulk campaign.
    //   2. Promote 'new' -> 'contacted' only.
    const now = new Date().toISOString()
    await db.from('prospects')
      .update({
        contacted_via: 'personal',
        last_contacted_at: now,
        updated_at: now,
      })
      .eq('id', prospect_id)
      .eq('org_id', orgId)

    await db.from('prospects')
      .update({ status: 'contacted' })
      .eq('id', prospect_id)
      .eq('status', 'new')

    return new Response(
      JSON.stringify({ copy_text: copy.copy_text, copy_id: copy.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof ProviderError) {
      const body = userMessageFor(err)
      const httpStatus = err.code === 'auth_failed' ? 401 : err.retryable ? 503 : 502
      return new Response(
        JSON.stringify(body),
        { status: httpStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    console.error('personalise error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
