// generate-captions — writes per-platform social copy for a completed asset.
//
// Called fire-and-forget by:
//   - generate-asset (synchronous image flow, after status='completed')
//   - poll-job-status (async video flow, after status='completed')
//
// Auth: JWT (org-scoped) for user-initiated regeneration, OR x-cron-secret
// for service-role calls from other edge functions (no JWT propagated cleanly).
//
// Body: { job_id: string, platforms?: string[], regenerate?: boolean }
//   - platforms defaults to all four: ['linkedin','x','instagram','whatsapp']
//   - regenerate=true forces overwrite even if captions already exist
//
// Writes: generation_jobs.captions = {
//   _status: 'pending'|'ready'|'failed',
//   _error?: string,
//   _generated_at: ISO,
//   <platform>: { text, hashtags, char_count, model_id, generated_at }
// }

import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/db.ts'
import { validateJWT } from '../_shared/auth.ts'
import { resolveApiKey, routeTextGeneration, ProviderError, userMessageFor } from '../_shared/providers/router.ts'

const DEFAULT_PLATFORMS = ['linkedin', 'x', 'instagram', 'whatsapp']
const ALLOWED_PLATFORMS = new Set(['linkedin', 'x', 'twitter', 'instagram', 'whatsapp'])

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

function summariseTone(brand: any): string {
  const axes: string[] = []
  const a = (n: number | null | undefined, low: string, high: string) => {
    if (n == null) return
    if (n <= 3) axes.push(low)
    else if (n >= 7) axes.push(high)
  }
  a(brand.tone_formal_conversational, 'formal', 'conversational')
  a(brand.tone_conservative_provocative, 'conservative', 'provocative')
  a(brand.tone_corporate_human, 'corporate', 'human')
  a(brand.tone_data_story, 'data-driven', 'story-driven')
  a(brand.tone_safe_bold, 'safe', 'bold')
  return axes.length ? axes.join(', ') : 'balanced, professional'
}

function extractJSON(text: string): { text: string; hashtags: string[] } | null {
  if (!text) return null
  // Strip code fences
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  // Find first '{' and last '}'
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1))
    if (typeof obj.text !== 'string') return null
    const hashtags = Array.isArray(obj.hashtags)
      ? obj.hashtags.filter((h: any) => typeof h === 'string').map((h: string) => h.startsWith('#') ? h : `#${h}`)
      : []
    return { text: obj.text.trim(), hashtags }
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp
  const corsHeaders = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    if (req.headers.get('content-length') && parseInt(req.headers.get('content-length')!) > 100_000) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers: corsHeaders })
    }

    // Auth FIRST — before parsing the body — so unauth callers can't probe field names.
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('x-cron-secret')
    const isCron = !!cronSecret && headerSecret === cronSecret

    let callerOrgId: string | null = null
    if (!isCron) {
      try {
        const { user } = await validateJWT(req)
        callerOrgId = (user.app_metadata?.org_id as string) ?? null
        if (!callerOrgId) {
          return new Response(JSON.stringify({ error: 'no_org' }), { status: 401, headers: corsHeaders })
        }
      } catch {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
      }
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body.job_id !== 'string') {
      return new Response(JSON.stringify({ error: 'job_id_required' }), { status: 400, headers: corsHeaders })
    }
    const job_id = body.job_id
    const regenerate = body.regenerate === true
    const requestedPlatforms: string[] = Array.isArray(body.platforms) && body.platforms.length
      ? body.platforms.filter((p: any) => typeof p === 'string' && ALLOWED_PLATFORMS.has(p))
      : DEFAULT_PLATFORMS

    const db = createServiceClient()

    const { data: job, error: jobErr } = await db
      .from('generation_jobs')
      .select('id, org_id, status, prompt_tags, content_job_json, signal_id, captions, asset_type')
      .eq('id', job_id)
      .single()

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'job_not_found' }), { status: 404, headers: corsHeaders })
    }

    if (callerOrgId && job.org_id !== callerOrgId) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: corsHeaders })
    }

    if (job.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'job_not_completed' }), { status: 409, headers: corsHeaders })
    }

    // Skip if already populated and not forcing regenerate
    if (!regenerate && job.captions && job.captions._status === 'ready') {
      const haveAll = requestedPlatforms.every(p => job.captions[p]?.text)
      if (haveAll) {
        return new Response(JSON.stringify({ status: 'already_ready', captions: job.captions }), {
          status: 200, headers: corsHeaders,
        })
      }
    }

    // Mark pending
    await db.from('generation_jobs').update({
      captions: { ...(job.captions ?? {}), _status: 'pending' },
    }).eq('id', job.id)

    // Fetch brand context
    const { data: brand } = await db
      .from('brand_contexts')
      .select(`
        company_name, one_sentence_pitch, extended_description, industry_sector,
        tone_formal_conversational, tone_conservative_provocative, tone_corporate_human,
        tone_data_story, tone_safe_bold,
        emoji_usage, cta_style, sentence_length, jargon_level,
        voice_examples, phrases_to_avoid, competitor_names, primary_platform
      `)
      .eq('org_id', job.org_id)
      .maybeSingle()

    const brandData: any = brand ?? {}

    // Fetch signal context (optional)
    let signalHeadline = ''
    if (job.signal_id) {
      const { data: signal } = await db
        .from('signals')
        .select('title, summary')
        .eq('id', job.signal_id)
        .maybeSingle()
      if (signal) {
        signalHeadline = (signal as any).title ?? (signal as any).summary ?? ''
      }
    }

    // Fetch org slug
    const { data: org } = await db.from('orgs').select('slug').eq('id', job.org_id).single()
    const orgSlug = (org as any)?.slug ?? ''

    // Resolve text model (org pref > available_models default for social_caption > outreach_copy fallback)
    let providerKey = 'openrouter'
    let modelId = 'deepseek/deepseek-v4-flash'

    const { data: pref } = await db
      .from('org_model_preferences')
      .select('provider_key, model_id')
      .eq('org_id', job.org_id)
      .eq('step_key', 'social_caption')
      .maybeSingle()

    if (pref) {
      providerKey = pref.provider_key
      modelId = pref.model_id
    } else {
      const { data: defaultModel } = await db
        .from('available_models')
        .select('provider_key, model_id, default_for_step_key')
        .contains('default_for_step_key', ['social_caption'])
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (defaultModel) {
        providerKey = (defaultModel as any).provider_key
        modelId = (defaultModel as any).model_id
      }
    }

    const apiKey = await resolveApiKey(job.org_id, providerKey)

    // Load all caption templates (org override > global)
    const { data: tplRows } = await db
      .from('prompt_templates')
      .select('section_key, position, template_text, org_id')
      .eq('step_key', 'social_caption')
      .eq('is_active', true)
      .or(`org_id.is.null,org_id.eq.${job.org_id}`)

    const tplMap = new Map<string, { template_text: string; isOrg: boolean }>()
    for (const row of (tplRows ?? [])) {
      const isOrg = !!(row as any).org_id
      const existing = tplMap.get((row as any).section_key)
      if (!existing || (isOrg && !existing.isOrg)) {
        tplMap.set((row as any).section_key, { template_text: (row as any).template_text, isOrg })
      }
    }

    // Build shared variables
    const promptTags: any = job.prompt_tags ?? {}
    const contentJob: any = job.content_job_json ?? {}
    const voiceEx: string[] = Array.isArray(brandData.voice_examples)
      ? brandData.voice_examples.filter((v: any) => typeof v === 'string')
      : []
    const phrasesAvoid: string[] = Array.isArray(brandData.phrases_to_avoid)
      ? brandData.phrases_to_avoid.filter((v: any) => typeof v === 'string')
      : []

    const visualDescription = [
      promptTags.subject,
      promptTags.visual_style,
      promptTags.mood,
    ].filter(Boolean).join(', ') || (contentJob.subject ?? 'a marketing visual')

    const sharedVars: Record<string, string> = {
      brand_name: brandData.company_name ?? 'our brand',
      brand_pitch: brandData.one_sentence_pitch ?? brandData.extended_description?.slice(0, 200) ?? '',
      tone_summary: summariseTone(brandData),
      emoji_usage: brandData.emoji_usage ?? 'minimal',
      cta_style: brandData.cta_style ?? 'soft ask',
      voice_example: voiceEx[0] ? `- Past post that performed well: "${voiceEx[0].slice(0, 280)}"` : '',
      phrases_to_avoid: phrasesAvoid.length ? `\nAvoid these phrases: ${phrasesAvoid.join(', ')}` : '',
      subject: promptTags.subject ?? contentJob.subject ?? 'our latest update',
      cta: promptTags.cta_text ?? promptTags.cta ?? 'Learn more',
      signal_headline: signalHeadline,
      visual_description: visualDescription,
    }

    // Generate one caption per requested platform in parallel
    const platforms = requestedPlatforms
    const results = await Promise.all(platforms.map(async (platform) => {
      const tpl = tplMap.get(platform) ?? tplMap.get(platform === 'twitter' ? 'x' : platform)
      if (!tpl) {
        return { platform, ok: false, error: 'no_template' as const }
      }
      const prompt = fillTemplate(tpl.template_text, { ...sharedVars, platform })
      try {
        const raw = await routeTextGeneration(
          providerKey,
          modelId,
          [{ role: 'user', content: prompt }],
          apiKey,
          job.org_id,
          orgSlug,
          job.id,
          'social_caption',
          { maxTokens: 800 },
        )
        const parsed = extractJSON(raw)
        if (!parsed) return { platform, ok: false, error: 'parse_failed' as const, raw }
        return {
          platform,
          ok: true as const,
          text: parsed.text,
          hashtags: parsed.hashtags,
          char_count: parsed.text.length,
          model_id: modelId,
          generated_at: new Date().toISOString(),
        }
      } catch (e) {
        return { platform, ok: false, error: (e as Error).message }
      }
    }))

    // Re-read latest captions to merge with anything that was there before
    const { data: latest } = await db
      .from('generation_jobs')
      .select('captions')
      .eq('id', job.id)
      .single()

    const captions: any = { ...(latest?.captions ?? {}) }
    let anySuccess = false
    let anyFail = false
    for (const r of results) {
      if (r.ok) {
        captions[r.platform] = {
          text: r.text,
          hashtags: r.hashtags,
          char_count: r.char_count,
          model_id: r.model_id,
          generated_at: r.generated_at,
        }
        anySuccess = true
      } else {
        anyFail = true
      }
    }

    captions._status = anySuccess ? 'ready' : 'failed'
    captions._generated_at = new Date().toISOString()
    if (anyFail && !anySuccess) {
      captions._error = results.find(r => !r.ok && 'error' in r)?.error ?? 'unknown'
    } else {
      delete captions._error
    }

    await db.from('generation_jobs').update({ captions }).eq('id', job.id)

    // Realtime broadcast so UIs subscribed to the job channel update instantly
    try {
      await db.channel(`job:${job.id}`).send({
        type: 'broadcast',
        event: 'captions_ready',
        payload: { job_id: job.id, captions },
      })
    } catch { /* ignore */ }

    return new Response(JSON.stringify({
      status: captions._status,
      captions,
      results: results.map(r => ({ platform: r.platform, ok: r.ok, error: 'error' in r ? r.error : undefined })),
    }), { status: 200, headers: corsHeaders })

  } catch (e) {
    if (e instanceof ProviderError) {
      const body = userMessageFor(e)
      const httpStatus = e.code === 'auth_failed' ? 401 : e.retryable ? 503 : 502
      return new Response(JSON.stringify(body), { status: httpStatus, headers: corsHeaders })
    }
    console.error('generate-captions error:', (e as Error).message)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
