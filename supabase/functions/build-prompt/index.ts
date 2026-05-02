import { validateJWT } from '../_shared/auth.ts'
import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/db.ts'

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
    const { signal_id, prompt_tags } = body

    if (!prompt_tags || typeof prompt_tags !== 'object') {
      return new Response(JSON.stringify({ error: 'prompt_tags_required' }), { status: 400, headers: corsHeaders })
    }
    if (!prompt_tags.subject || typeof prompt_tags.subject !== 'string') {
      return new Response(JSON.stringify({ error: 'subject_required' }), { status: 400, headers: corsHeaders })
    }

    const db = createServiceClient()

    // Fetch brand context — direct SELECT, no pgvector in v1
    const { data: brand, error: brandError } = await db
      .from('brand_contexts')
      .select('*')
      .eq('org_id', org_id)
      .single()

    if (brandError || !brand) {
      return new Response(JSON.stringify({ error: 'brand_context_not_found' }), { status: 404, headers: corsHeaders })
    }

    // Fetch signal if provided
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

    // Get org slug
    const { data: org } = await db
      .from('orgs')
      .select('slug, plan_tier')
      .eq('id', org_id)
      .single()

    // Resolve model for image_generation step
    let modelId = 'google/gemini-3.1-flash-image-preview'
    let providerKey = 'openrouter'

    const { data: pref } = await db
      .from('org_model_preferences')
      .select('model_id, provider_key')
      .eq('org_id', org_id)
      .eq('step_key', 'image_generation')
      .maybeSingle()

    if (pref) {
      modelId = pref.model_id
      providerKey = pref.provider_key
    } else {
      const { data: defaultModel } = await db
        .from('available_models')
        .select('model_id, provider_key')
        .contains('default_for_step_key', ['image_generation'])
        .eq('is_active', true)
        .maybeSingle()
      if (defaultModel) {
        modelId = defaultModel.model_id
        providerKey = defaultModel.provider_key
      }
    }

    const themes: string[] = Array.isArray(brand.active_themes) ? brand.active_themes : []
    const titles: string[] = Array.isArray(brand.decision_maker_titles) ? brand.decision_maker_titles : []
    const voiceExamples: string[] = Array.isArray(brand.voice_examples)
      ? brand.voice_examples.filter(Boolean)
      : []
    const competitors: string[] = Array.isArray(brand.competitor_names) ? brand.competitor_names : []
    const topicsToAvoid: string[] = Array.isArray(brand.topics_to_avoid) ? brand.topics_to_avoid : []
    const visualStylesToAvoid: string[] = Array.isArray(brand.visual_styles_to_avoid) ? brand.visual_styles_to_avoid : []
    const phrasesToAvoid: string[] = Array.isArray(brand.phrases_to_avoid) ? brand.phrases_to_avoid : []

    // Build brand context summary
    let brandContextSummary = [
      brand.one_sentence_pitch ?? '',
      brand.extended_description ?? '',
      themes.length ? `Themes: ${themes.join(', ')}` : '',
      titles.length ? `Audience: ${titles.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    if (brand.brand_guidelines_text) {
      brandContextSummary = `Brand Guidelines:\n${brand.brand_guidelines_text}\n\n${brandContextSummary}`
    }

    const pt = prompt_tags as Record<string, string>

    // Build compiled prompt
    const compiledPromptParts = [
      `You are creating a B2B marketing image for ${brand.company_name ?? 'the company'}.`,
      `Brand context: ${brandContextSummary}`,
      voiceExamples.length ? `Voice examples: ${voiceExamples.join('\n---\n')}` : '',
      signal ? `Trend context: ${signal.headline}: ${signal.summary ?? ''}` : '',
      `Subject: ${pt.subject ?? ''}`,
      pt.visual_style ? `Style: ${pt.visual_style}` : '',
      pt.mood ? `Mood: ${pt.mood}` : '',
      pt.colour_palette ? `Colour palette: ${pt.colour_palette}` : '',
      pt.platform ? `Platform: ${pt.platform}` : '',
      pt.aspect_ratio ? `Aspect ratio: ${pt.aspect_ratio}` : '',
      pt.cta_text ? `CTA: ${pt.cta_text}` : '',
      pt.additional_notes ? `Additional: ${pt.additional_notes}` : '',
      competitors.length ? `Do not reference: ${competitors.join(', ')}` : '',
    ].filter(Boolean)

    const compiledPrompt = compiledPromptParts.join('\n')

    // Build compiled negative
    const negativeParts = [
      pt.negative_prompt ?? '',
      topicsToAvoid.join(', '),
      visualStylesToAvoid.join(', '),
      phrasesToAvoid.join(', '),
    ].filter(Boolean)
    const compiledNegative = negativeParts.join(', ')

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
        platform: pt.platform ?? 'LinkedIn',
      },
    }

    return new Response(JSON.stringify({ content_job: contentJob }), { status: 200, headers: corsHeaders })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('build-prompt error')
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
