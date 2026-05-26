import { validateJWT, requireRole } from '../_shared/auth.ts'
import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/db.ts'

// ----- helpers -----
function truncate(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '\u2026' : s
}

function dedupeTokens(s: string): string {
  return Array.from(new Set(
    s.split(/[,\n]/).map(t => t.trim().toLowerCase()).filter(Boolean)
  )).join(', ')
}

function stripTextDirectives(notes: string): string {
  const patterns = [
    /[A-Z][a-z]+(?:\s+[a-z]+)*\s+(?:white\s+)?sans-serif\s+headline[^.]*\./gi,
    /Underneath,?\s+a\s+smaller\s+subtitle[^.]*\./gi,
    /Render\s+.*?(?:typography|text|CTA)[^.]*\./gi,
    /(?:Clean|Bold|Large)\s+.*?typography[^.]*\./gi,
    /\btext\s+overlay[^.]*\./gi,
    /\bheadline[^.]*\b(?:top|bottom)[^.]*\./gi,
    /\bsubtitle[^.]*\./gi,
    /\btext\s+(?:in|at|on|overlay)[^.]*\./gi,
    /open\s+for\s+text\s+overlay[^.]*\./gi,
  ]
  let result = notes
  for (const p of patterns) {
    result = result.replace(p, '')
  }
  return result.replace(/\s{2,}/g, ' ').trim()
}

function buildColoursBlock(brandColours: any, ptColourPalette?: string): string {
  if (brandColours && typeof brandColours === 'object') {
    const parts: string[] = []
    if (brandColours.primary) parts.push(`Primary: ${brandColours.primary}`)
    if (brandColours.secondary) parts.push(`Secondary: ${brandColours.secondary}`)
    if (brandColours.accent) parts.push(`Accent: ${brandColours.accent}`)
    if (parts.length) return parts.join('\n')
  }
  return ptColourPalette ?? '(use neutral, professional palette)'
}

function buildSignalBlock(signal: any): string {
  if (!signal) return '(no specific trend context)'
  const head = truncate(signal.headline, 120)
  const sum = truncate(signal.summary, 200)
  return sum ? `${head} \u2014 ${sum}` : head
}

function buildCtaBlock(ctaText?: string): string {
  const cta = (ctaText ?? '').trim()
  if (!cta) return ''
  return `Render ONLY this single CTA as clean sans-serif typography in the bottom-right or bottom-centre, high contrast, one line: "${cta}". No other text anywhere else in the image.`
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

function isMostlyEmpty(s: string): boolean {
  const stripped = s.replace(/\[[A-Z]+\]/g, '').replace(/\s+/g, ' ').trim()
  return stripped.length < 5
}

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

    const contentLength = parseInt(req.headers.get('content-length') ?? '0')
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers: corsHeaders })
    }

    const body = await req.json()
    const { signal_id, prompt_tags, step_key: requestedStep } = body
    const stepKey = (requestedStep && typeof requestedStep === 'string') ? requestedStep : 'image_generation'

    if (!prompt_tags || typeof prompt_tags !== 'object') {
      return new Response(JSON.stringify({ error: 'prompt_tags_required' }), { status: 400, headers: corsHeaders })
    }
    if (!prompt_tags.subject || typeof prompt_tags.subject !== 'string') {
      return new Response(JSON.stringify({ error: 'subject_required' }), { status: 400, headers: corsHeaders })
    }

    const db = createServiceClient()
    await requireRole(org_id, user.id, 'member', db)

    const { data: brandData } = await db
      .from('brand_contexts')
      .select('*')
      .eq('org_id', org_id)
      .maybeSingle()

    // If brand context hasn't been set up yet, fall back to org name + sensible defaults
    // so generation still works for new clients without blocking on onboarding completion.
    const { data: orgRow } = await db
      .from('orgs')
      .select('slug')
      .eq('id', org_id)
      .maybeSingle()

    const brand = brandData ?? {
      company_name: orgRow?.slug ?? 'the company',
      one_sentence_pitch: null,
      extended_description: null,
      brand_guidelines_text: null,
      active_themes: [],
      decision_maker_titles: [],
      competitor_names: [],
      topics_to_avoid: [],
      visual_styles_to_avoid: [],
      phrases_to_avoid: [],
      voice_examples: [],
      brand_colours: null,
    }

    let signal: any = null
    if (signal_id && typeof signal_id === 'string') {
      const { data: sig } = await db
        .from('signals')
        .select('id, headline, summary, url, source_type, published_at')
        .eq('id', signal_id)
        .eq('org_id', org_id)
        .single()
      signal = sig
    }

    // Fetch plan_tier separately (slug already fetched above)
    const { data: orgPlan } = await db
      .from('orgs')
      .select('plan_tier')
      .eq('id', org_id)
      .maybeSingle()
    const org = { slug: orgRow?.slug ?? '', plan_tier: orgPlan?.plan_tier ?? 'starter' }

    // Resolve model
    let modelId = 'google/gemini-3.1-flash-image-preview'
    let providerKey = 'openrouter'
    const { data: pref } = await db
      .from('org_model_preferences')
      .select('model_id, provider_key')
      .eq('org_id', org_id)
      .eq('step_key', stepKey)
      .maybeSingle()
    if (pref) {
      modelId = pref.model_id
      providerKey = pref.provider_key
    } else {
      const { data: defaultModel } = await db
        .from('available_models')
        .select('model_id, provider_key')
        .contains('default_for_step_key', [stepKey])
        .eq('is_active', true)
        .maybeSingle()
      if (defaultModel) {
        modelId = defaultModel.model_id
        providerKey = defaultModel.provider_key
      }
    }

    // Brand fields
    const themes: string[] = Array.isArray(brand.active_themes) ? brand.active_themes : []
    const titles: string[] = Array.isArray(brand.decision_maker_titles) ? brand.decision_maker_titles : []
    const competitors: string[] = Array.isArray(brand.competitor_names) ? brand.competitor_names : []
    const topicsToAvoid: string[] = Array.isArray(brand.topics_to_avoid) ? brand.topics_to_avoid : []
    const visualStylesToAvoid: string[] = Array.isArray(brand.visual_styles_to_avoid) ? brand.visual_styles_to_avoid : []
    const phrasesToAvoid: string[] = Array.isArray(brand.phrases_to_avoid) ? brand.phrases_to_avoid : []
    const voiceExamples: string[] = Array.isArray(brand.voice_examples)
      ? brand.voice_examples.filter(Boolean)
      : []

    const pt = prompt_tags as Record<string, string>

    // Combine + dedupe negatives as comma tokens
    // Build brand style guidance (positive framing — per Nano Banana / Gemini best practices)
    // Visual styles to avoid → converted to positive equivalents in [QUALITY] section
    // Negatives kept as metadata only (compiled_negative) — not injected into the prompt
    const negativeRaw = [
      pt.negative_prompt ?? '',
      topicsToAvoid.join(', '),
      visualStylesToAvoid.join(', '),
      phrasesToAvoid.join(', '),
    ].filter(Boolean).join(', ')
    const negativeTokens = dedupeTokens(negativeRaw)

    // Variable bag for template substitution
    const vars: Record<string, string> = {
      company_name: brand.company_name ?? 'the company',
      one_sentence_pitch: brand.one_sentence_pitch ?? '',
      extended_description: truncate(brand.extended_description, 1200),
      brand_guidelines_text: truncate(brand.brand_guidelines_text, 2500),
      active_themes: themes.join(', '),
      decision_maker_titles: titles.join(', '),
      brand_colours_block: buildColoursBlock(brand.brand_colours, pt.colour_palette),
      signal_block: buildSignalBlock(signal),
      subject: pt.subject ?? '',
      visual_style: pt.visual_style ?? 'photography',
      mood: pt.mood ?? 'professional',
      platform: pt.platform ?? 'linkedin',
      aspect_ratio: pt.aspect_ratio ?? '1:1',
      cta_block: buildCtaBlock(pt.cta_text),
      additional_notes: truncate(stripTextDirectives(pt.additional_notes ?? ''), 1500),
      video_output_spec: (() => {
        const dur = pt.video_duration && pt.video_duration !== 'auto'
          ? (pt.video_duration.endsWith('s') ? pt.video_duration : `${pt.video_duration}s`)
          : ''
        const parts = [dur ? `${dur} clip` : '', pt.video_resolution ?? ''].filter(Boolean)
        return parts.length ? `(${parts.join(', ')})` : ''
      })(),
    }

    // Load template sections from DB (org override > global)
    const { data: sectionRows, error: tplError } = await db
      .from('prompt_templates')
      .select('section_key, position, template_text, org_id')
      .eq('step_key', stepKey)
      .eq('is_active', true)
      .or(`org_id.is.null,org_id.eq.${org_id}`)
      .order('position', { ascending: true })

    if (tplError || !sectionRows || sectionRows.length === 0) {
      return new Response(JSON.stringify({ error: 'no_prompt_template_configured' }), { status: 500, headers: corsHeaders })
    }

    // Org-specific row always overrides global for the same section_key
    const sectionMap = new Map<string, { position: number; template_text: string; isOrg: boolean }>()
    for (const row of sectionRows) {
      const existing = sectionMap.get(row.section_key)
      const isOrg = !!row.org_id
      if (!existing || (isOrg && !existing.isOrg)) {
        sectionMap.set(row.section_key, { position: row.position, template_text: row.template_text, isOrg })
      }
    }

    const compiledSections = Array.from(sectionMap.values())
      .sort((a, b) => a.position - b.position)
      .map(v => fillTemplate(v.template_text, vars))
      .filter(s => !isMostlyEmpty(s))

    const compiledPrompt = compiledSections.join('\n\n')
    const compiledNegative = negativeTokens

    // Kept for backwards-compatibility
    const brandContextSummary = [
      vars.one_sentence_pitch,
      vars.extended_description,
      themes.length ? `Themes: ${themes.join(', ')}` : '',
      titles.length ? `Audience: ${titles.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    const contentJob = {
      org_id,
      org_slug: org?.slug ?? '',
      brand_context_summary: brandContextSummary,
      signal_id: signal?.id ?? null,
      signal_headline: signal?.headline ?? null,
      signal_summary: signal?.summary ?? null,
      asset_type: 'image',
      model_id: modelId,
      provider_key: providerKey,
      prompt_tags: pt,
      compiled_prompt: compiledPrompt,
      compiled_negative: compiledNegative,
      voice_examples: voiceExamples,
      brand_colours: brand.brand_colours ?? null,
      image_config: {
        aspect_ratio: pt.aspect_ratio ?? '1:1',
        platform: pt.platform ?? 'linkedin',
      },
      template_sections_used: Array.from(sectionMap.keys()),
    }

    return new Response(JSON.stringify({ content_job: contentJob }), { status: 200, headers: corsHeaders })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('build-prompt error')
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
