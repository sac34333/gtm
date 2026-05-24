import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { resolveApiKey, routeTextGeneration, ProviderError, userMessageFor } from '../_shared/providers/router.ts'
import { GenerateCampaignBriefBodySchema } from '../_shared/schemas.ts'

/** Resolve the default model for a given step_key */
async function resolveDefaultModel(
  db: any, orgId: string, stepKey: string,
): Promise<{ providerKey: string; modelId: string }> {
  const { data: pref } = await db.from('org_model_preferences')
    .select('provider_key, model_id').eq('org_id', orgId).eq('step_key', stepKey).single()
  if (pref) return { providerKey: pref.provider_key, modelId: pref.model_id }
  const { data: def } = await db.from('available_models')
    .select('provider_key, model_id').contains('default_for_step_key', [stepKey]).eq('is_active', true).single()
  if (def) return { providerKey: def.provider_key, modelId: def.model_id }
  return { providerKey: 'google_ai_studio', modelId: 'gemini-3-flash-preview' }
}

interface PostingDay {
  day: number
  recommended_date: string
  phase: string              // pre_launch | launch | sustain | recap
  channel: string            // linkedin_post / email / twitter / etc.
  post_type: string          // teaser, announcement, use_case, founder_pov, social_proof, recap
  theme: string              // short title
  hook: string               // opening line idea
  time_local: string
  time_utc: string
  // legacy aliases (back-compat with v1 schema)
  platform?: string
}

interface LinkedInPost { hook: string; body: string; cta: string; hashtags?: string[]; first_comment?: string }
interface FacebookPost { hook: string; body: string; cta: string; hashtags?: string[]; first_comment?: string }
interface TwitterPost { tweet: string; thread?: string[] }
interface EmailVariant { subject: string; subject_b?: string; preview: string; body: string; cta: string; plain_text_body?: string }
interface DmVariant { opener: string; body: string; ask: string }
interface TimingRec { best_days?: string[]; best_times?: string[]; rationale?: string }

interface BriefData {
  // Top-level positioning
  executive_summary?: string
  // Why this brief was built this way (positioning + audience + goal). Shown
  // to the client at the top of the campaign page so they can see relevance.
  executive_summary_rationale?: string
  key_messages?: string[]
  primary_cta?: string

  // 14-day launch arc
  posting_schedule: PostingDay[]

  // Per-channel content (any subset depending on channel_mix)
  content?: {
    linkedin_post?: LinkedInPost[]
    linkedin_message?: DmVariant[]
    twitter?: TwitterPost[]
    facebook_post?: FacebookPost[]
    email?: EmailVariant[]
    cold_dm?: DmVariant[]
  }

  // Hashtag bank — split for strategic use
  hashtag_sets: {
    branded?: string[]
    industry?: string[]
    general?: string[]
    regional?: string[]
    niche?: string[]
  }

  // Channel intelligence
  timing_recommendations: Record<string, TimingRec | string>

  // Backward-compat legacy fields (v1)
  caption_variants?: Record<string, string[]>
  hashtags?: string[]
  best_time_to_post?: Record<string, string>
}

// Sanitise non-Latin1 chars so pdf-lib StandardFont (Helvetica) doesn't crash.
function sanitisePdfText(text: string): string {
  return (text ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '?')
}

// Approximate Helvetica char width — used for word wrapping.
function widthOf(text: string, size: number): number {
  // Helvetica avg char width factor ~0.5 of font size, slightly higher for bold.
  return text.length * size * 0.5
}

async function generatePdf(brief: BriefData, brand: any, campaignInfo: any, campaignName: string, durationDays = 14): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import('npm:pdf-lib')

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const PAGE_W = 595
  const PAGE_H = 842
  const MARGIN = 50
  const CONTENT_W = PAGE_W - MARGIN * 2

  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
    }
  }

  function drawLine(text: string, opts: {
    x?: number; size?: number; bold?: boolean; italic?: boolean; color?: any; gap?: number
  } = {}) {
    const { x = MARGIN, size = 10, bold = false, italic = false, color = rgb(0.1, 0.1, 0.1), gap } = opts
    const lh = gap ?? Math.round(size * 1.4)
    ensureSpace(lh)
    const f = bold ? boldFont : italic ? italicFont : font
    page.drawText(sanitisePdfText(text), { x, y, size, font: f, color })
    y -= lh
  }

  function drawWrapped(text: string, opts: {
    x?: number; size?: number; bold?: boolean; italic?: boolean; color?: any; maxWidth?: number; gap?: number
  } = {}) {
    const { x = MARGIN, size = 10, bold = false, italic = false, color = rgb(0.1, 0.1, 0.1), maxWidth, gap } = opts
    const lh = gap ?? Math.round(size * 1.4)
    const w = maxWidth ?? (PAGE_W - x - MARGIN)
    const safe = sanitisePdfText(text)
    const words = safe.split(/\s+/)
    let line = ''
    const f = bold ? boldFont : italic ? italicFont : font
    for (const word of words) {
      const tentative = line ? line + ' ' + word : word
      if (widthOf(tentative, size) > w && line) {
        ensureSpace(lh)
        page.drawText(line, { x, y, size, font: f, color })
        y -= lh
        line = word
      } else {
        line = tentative
      }
    }
    if (line) {
      ensureSpace(lh)
      page.drawText(line, { x, y, size, font: f, color })
      y -= lh
    }
  }

  function spacer(h = 10) { y -= h }

  function drawDivider(color = rgb(0.85, 0.85, 0.92)) {
    ensureSpace(8)
    page.drawLine({
      start: { x: MARGIN, y: y - 2 },
      end: { x: PAGE_W - MARGIN, y: y - 2 },
      thickness: 0.6,
      color,
    })
    y -= 10
  }

  function drawSectionHeading(title: string) {
    spacer(12)
    ensureSpace(36)
    drawLine(title, { size: 14, bold: true, color: rgb(0.18, 0.22, 0.78), gap: 20 })
    drawDivider(rgb(0.18, 0.22, 0.78))
    spacer(8)
  }

  function drawSubHeading(title: string, color = rgb(0.25, 0.25, 0.4)) {
    spacer(4)
    drawLine(title, { size: 11, bold: true, color, gap: 16 })
  }

  function labelValue(label: string, value: string) {
    drawLine(label, { size: 9, bold: true, color: rgb(0.4, 0.4, 0.5), gap: 12 })
    drawWrapped(value, { x: MARGIN, size: 10, color: rgb(0.15, 0.15, 0.15), gap: 13 })
  }

  // ── Cover ─────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PAGE_H - 120, width: PAGE_W, height: 120, color: rgb(0.07, 0.09, 0.27) })
  y = PAGE_H - 50
  drawLine(`Campaign Brief`, { x: MARGIN, size: 11, color: rgb(0.7, 0.75, 0.95), gap: 18 })
  drawLine(campaignName, { x: MARGIN, size: 22, bold: true, color: rgb(1, 1, 1), gap: 28 })
  drawLine(brand.company_name ?? 'Your Company', { x: MARGIN, size: 11, color: rgb(0.85, 0.85, 0.95), gap: 16 })
  y = PAGE_H - 140

  // Meta
  spacer(10)
  const assetLine = campaignInfo?.prompt_tags?.subject
    ? `${campaignInfo.asset_type ?? 'asset'}: ${campaignInfo.prompt_tags.subject}`
    : 'No creative asset linked'
  drawLine(`Asset  ${assetLine}`, { size: 9, color: rgb(0.45, 0.45, 0.55), gap: 13 })
  drawLine(`Generated  ${new Date().toLocaleDateString()}`, { size: 9, color: rgb(0.45, 0.45, 0.55), gap: 13 })

  // ── Audience profile ───────────────────────────────────────────────────────
  const audienceProfile = (brief as any).audience_profile
  if (audienceProfile?.summary) {
    drawSectionHeading('Audience')
    drawLine(`${audienceProfile.total ?? 0} prospect(s) enrolled from your ICP`, { size: 9, color: rgb(0.4, 0.4, 0.5), gap: 14 })
    // The summary is a multi-line string built with newlines + padding; split + render line-by-line.
    for (const raw of String(audienceProfile.summary).split('\n')) {
      const line = raw.trim()
      if (!line) continue
      drawWrapped(line, { size: 10, gap: 13, color: rgb(0.2, 0.2, 0.25) })
    }
  }

  // ── Executive summary ──────────────────────────────────────────────────────
  if (brief.executive_summary) {
    drawSectionHeading('Executive Summary')
    drawWrapped(brief.executive_summary, { size: 11, gap: 16 })
  }

  // ── Key messages ───────────────────────────────────────────────────────────
  if (brief.key_messages?.length) {
    drawSectionHeading('Key Messages')
    for (const msg of brief.key_messages) {
      drawWrapped(`-  ${msg}`, { size: 10, gap: 14 })
    }
    if (brief.primary_cta) {
      spacer(6)
      drawLine('Primary CTA', { size: 9, bold: true, color: rgb(0.4, 0.4, 0.5), gap: 12 })
      drawWrapped(brief.primary_cta, { size: 11, bold: true, color: rgb(0.18, 0.22, 0.78), gap: 16 })
    }
  }

  // ── Launch arc ──────────────────────────────────────────────────────
  if (brief.posting_schedule?.length) {
    drawSectionHeading(`${durationDays}-Day Launch Arc`)
    let lastPhase = ''
    for (const day of brief.posting_schedule.slice(0, durationDays)) {
      const phase = day.phase ?? 'sustain'
      if (phase !== lastPhase) {
        spacer(4)
        drawLine(phase.replace(/_/g, ' ').toUpperCase(), { size: 9, bold: true, color: rgb(0.5, 0.3, 0.7), gap: 13 })
        lastPhase = phase
      }
      const channel = day.channel ?? day.platform ?? '-'
      const time = `${day.time_local ?? ''}${day.time_utc ? ` (${day.time_utc} UTC)` : ''}`
      drawLine(
        `Day ${day.day ?? '-'}  ${day.recommended_date}  |  ${channel}  |  ${day.post_type ?? ''}  |  ${time}`,
        { size: 10, bold: true, gap: 13 }
      )
      if (day.theme) drawWrapped(`Theme: ${day.theme}`, { x: MARGIN + 14, size: 9.5, color: rgb(0.3, 0.3, 0.4), gap: 13 })
      if (day.hook)  drawWrapped(`Hook:  ${day.hook}`,   { x: MARGIN + 14, size: 9.5, italic: true, color: rgb(0.3, 0.3, 0.4), gap: 13 })
      spacer(4)
    }
  }

  // ── Channel content ────────────────────────────────────────────────────────
  const c = brief.content ?? {}

  if (c.linkedin_post?.length) {
    drawSectionHeading('LinkedIn Posts')
    c.linkedin_post.forEach((p, i) => {
      drawSubHeading(`Variant ${i + 1}`)
      labelValue('Hook', p.hook)
      labelValue('Body', p.body)
      labelValue('CTA',  p.cta)
      if (p.hashtags?.length) labelValue('Hashtags', p.hashtags.join(' '))
      spacer(6)
    })
  }

  if (c.email?.length) {
    drawSectionHeading('Email Variants')
    c.email.forEach((e, i) => {
      drawSubHeading(`Variant ${i + 1}`)
      labelValue('Subject',  e.subject)
      labelValue('Preview',  e.preview)
      labelValue('Body',     e.body)
      labelValue('CTA',      e.cta)
      spacer(6)
    })
  }

  if (c.twitter?.length) {
    drawSectionHeading('Twitter / X')
    c.twitter.forEach((t, i) => {
      drawSubHeading(`Tweet ${i + 1}`)
      drawWrapped(t.tweet, { size: 10, gap: 14 })
      if (t.thread?.length) {
        spacer(2)
        drawLine('Thread continuation:', { size: 9, color: rgb(0.4, 0.4, 0.5), gap: 12 })
        t.thread.forEach((tw, j) => {
          drawWrapped(`${j + 2}/  ${tw}`, { x: MARGIN + 12, size: 9.5, color: rgb(0.3, 0.3, 0.4), gap: 13 })
        })
      }
      spacer(6)
    })
  }

  if (c.linkedin_message?.length) {
    drawSectionHeading('LinkedIn DM Templates')
    c.linkedin_message.forEach((d, i) => {
      drawSubHeading(`Template ${i + 1}`)
      labelValue('Opener', d.opener)
      labelValue('Body',   d.body)
      labelValue('Ask',    d.ask)
      spacer(6)
    })
  }

  if (c.cold_dm?.length) {
    drawSectionHeading('Cold DM Templates')
    c.cold_dm.forEach((d, i) => {
      drawSubHeading(`Template ${i + 1}`)
      labelValue('Opener', d.opener)
      labelValue('Body',   d.body)
      labelValue('Ask',    d.ask)
      spacer(6)
    })
  }

  // ── Hashtag bank ───────────────────────────────────────────────────────────
  const sets = brief.hashtag_sets ?? {}
  const hasAny = (sets.branded?.length || sets.industry?.length || sets.general?.length || sets.regional?.length || sets.niche?.length)
  if (hasAny) {
    drawSectionHeading('Hashtag Bank')
    const groups: Array<[string, string[] | undefined]> = [
      ['Branded',  sets.branded],
      ['Industry', sets.industry],
      ['General',  sets.general],
      ['Niche',    sets.niche],
      ['Regional', sets.regional],
    ]
    for (const [label, tags] of groups) {
      if (!tags?.length) continue
      drawLine(label, { size: 9, bold: true, color: rgb(0.4, 0.4, 0.5), gap: 12 })
      drawWrapped(tags.map(t => t.startsWith('#') ? t : '#' + t).join('  '), { size: 10, gap: 14 })
      spacer(2)
    }
  }

  // ── Timing recommendations ─────────────────────────────────────────────────
  if (brief.timing_recommendations && Object.keys(brief.timing_recommendations).length) {
    drawSectionHeading('Channel Timing & Best Practices')
    for (const [channel, rec] of Object.entries(brief.timing_recommendations)) {
      drawSubHeading(channel.replace(/_/g, ' '))
      if (typeof rec === 'string') {
        drawWrapped(rec, { size: 10, gap: 14 })
      } else {
        if (rec?.best_days?.length)  labelValue('Best days',   rec.best_days.join(', '))
        if (rec?.best_times?.length) labelValue('Best times',  rec.best_times.join(', '))
        if (rec?.rationale)          labelValue('Why',         rec.rationale)
      }
      spacer(4)
    }
  }

  // ── Footer on last page ────────────────────────────────────────────────────
  spacer(20)
  drawDivider(rgb(0.85, 0.85, 0.92))
  drawLine(`Generated by GTM Engine - ${brand.company_name ?? ''}`, { size: 8, color: rgb(0.55, 0.55, 0.6), gap: 12 })

  return await pdfDoc.save()
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawBody = await req.json()
    const parseResult = GenerateCampaignBriefBodySchema.safeParse(rawBody)
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'validation_failed', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const body = parseResult.data
    const { campaign_id } = body

    // Fetch existing campaign (must belong to this org)
    const { data: campaign, error: campaignErr } = await db
      .from('campaign_briefs')
      .select('*')
      .eq('id', campaign_id)
      .eq('org_id', orgId)
      .single()

    if (campaignErr || !campaign) {
      return new Response(JSON.stringify({ error: 'campaign_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve job_id, channel_mix, prospect list
    const jobId = body.job_id ?? campaign.job_id
    const channelMix: string[] = body.channel_mix ?? campaign.channel_mix ?? ['linkedin_message', 'email']
    // Resolve campaign length. Falls back to 14 for older campaigns whose row
    // pre-dates the duration_days column. workingDaysOnly defaults to true.
    const durationDays: number = Math.max(1, Math.min(90, Number(campaign.duration_days ?? 14)))
    const workingDaysOnly: boolean = campaign.working_days_only !== false

    let prospectIds: string[] = body.prospect_ids ?? []
    if (prospectIds.length === 0) {
      const { data: cpRows } = await db.from('campaign_prospects')
        .select('prospect_id').eq('campaign_id', campaign_id).eq('org_id', orgId)
      prospectIds = (cpRows ?? []).map((r: any) => r.prospect_id)
    }

    // If no campaign-specific prospects, fall back to org-level prospects
    // (ICP enrichment creates prospects at org level but campaign_prospects
    // may not be populated yet)
    let prospects: any[] = []
    if (prospectIds.length) {
      const { data: pRows } = await db.from('prospects').select('*').in('id', prospectIds).eq('org_id', orgId)
      prospects = pRows ?? []
    }
    if (!prospects.length) {
      const { data: orgProspects } = await db.from('prospects').select('*').eq('org_id', orgId).limit(50)
      prospects = orgProspects ?? []
    }

    // Fetch brand context
    const { data: brand } = await db.from('brand_contexts').select('*').eq('org_id', orgId).single()
    if (!brand) {
      return new Response(JSON.stringify({ error: 'brand_context_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch job if linked
    let job: any = null
    if (jobId) {
      const { data: jobRow } = await db.from('generation_jobs').select('*')
        .eq('id', jobId).eq('org_id', orgId).single()
      job = jobRow
    }

    // Fetch org slug + timezone
    const { data: orgRow } = await db.from('orgs').select('slug, timezone').eq('id', orgId).single()
    const orgSlug = (orgRow as any)?.slug ?? ''
    const timezone = (orgRow as any)?.timezone ?? brand.timezone ?? 'UTC'

    // Resolve text model for campaign_brief step
    const { providerKey, modelId } = await resolveDefaultModel(db, orgId, 'campaign_brief')
    const apiKey = await resolveApiKey(orgId, providerKey)

    const assetDescription = job
      ? `${job.asset_type ?? 'image'} — ${job.content_job_json?.prompt_tags?.subject ?? 'Campaign Asset'}`
      : 'No asset linked'

    const channelList = channelMix.join(', ')

    // Compute actual schedule dates respecting start_date + working_days_only
    const campaignStartDate = campaign.start_date
      ? String(campaign.start_date).slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    const scheduleDates: string[] = []
    if (workingDaysOnly) {
      let d = new Date(campaignStartDate + 'T12:00:00Z')
      while (scheduleDates.length < durationDays) {
        const dow = d.getUTCDay()
        if (dow !== 0 && dow !== 6) scheduleDates.push(d.toISOString().slice(0, 10))
        d.setUTCDate(d.getUTCDate() + 1)
      }
    } else {
      const base = new Date(campaignStartDate + 'T12:00:00Z')
      for (let i = 0; i < durationDays; i++) {
        const d = new Date(base)
        d.setUTCDate(d.getUTCDate() + i)
        scheduleDates.push(d.toISOString().slice(0, 10))
      }
    }
    const scheduleDatesNote = workingDaysOnly
      ? `The campaign starts ${campaignStartDate} and skips weekends. Use these EXACT working-day dates for the schedule entries:\n${scheduleDates.map((d, i) => `  Day ${i + 1}: ${d}`).join('\n')}`
      : `The campaign starts ${campaignStartDate}. Generate schedule entries from ${scheduleDates[0]} to ${scheduleDates[scheduleDates.length - 1]}.`

    // Build per-channel content schema sections only for selected channels.
    const contentSchemaParts: string[] = []
    if (channelMix.includes('linkedin_post')) {
      contentSchemaParts.push(`    "linkedin_post": [
      { "hook": "first 3 lines visible before 'see more' — curiosity gap, NOT topic statement", "body": "1200-1500 chars, 1-2 sentences per paragraph, blank line between every paragraph (use \\n\\n), end with engagement question", "cta": "single CTA in its own paragraph above the engagement question", "hashtags": ["3-5 hashtags placed at very end only — NEVER in first 100 chars"], "first_comment": "URL or link teaser to post as first comment within 60s — empty string if no link applies" }
    ]`)
    }
    if (channelMix.includes('linkedin_message')) {
      contentSchemaParts.push(`    "linkedin_message": [
      { "opener": "references a specific recent post, company news, role change, mutual, or bio detail — NEVER 'Hi {{name}}' alone", "body": "120-180 chars MAX, lead with relevance then bridge to value, NO links", "ask": "soft, low-friction, time-bounded (e.g. 'open to a 15-min chat next Tue or Wed?'). For C-suite, ask for a reply not a meeting." }
    ]`)
    }
    if (channelMix.includes('email')) {
      contentSchemaParts.push(`    "email": [
      { "subject": "variant A (curiosity-driven), under 55 chars, no emoji/CAPS/spam triggers", "subject_b": "variant B (direct/outcome-driven), under 55 chars, also spam-safe", "preview": "60-90 chars preheader — must NOT repeat subject, treat as second hook", "body": "120-180 words, 3-4 short paragraphs, Problem-Agitate-Solve framework, mandatory PS line", "cta": "single specific CTA with action-verb anchor text, never 'click here'", "plain_text_body": "plain-text twin of body — bare URLs, no HTML — for cold B2B deliverability" }
    ]`)
    }
    if (channelMix.includes('twitter') || channelMix.includes('twitter_x')) {
      contentSchemaParts.push(`    "twitter": [
      { "tweet": "under 280 chars; first 8 words quote-tweetable on their own; no link in hook tweet", "thread": ["tweets 2-N if needed, one idea per tweet, link only in the FINAL tweet"] }
    ]`)
    }
    if (channelMix.includes('facebook_post') || channelMix.includes('facebook')) {
      contentSchemaParts.push(`    "facebook_post": [
      { "hook": "first 1-2 sentences (Feed truncates to ~100 chars on mobile)", "body": "80-120 words for organic reach, end with one meaningful question to drive comment-thread engagement", "cta": "clear ask — Facebook rewards conversation over clicks", "hashtags": ["1-3 branded hashtags max — overuse looks spammy on Facebook"], "first_comment": "any external URL goes here, NOT in the body" }
    ]`)
    }
    if (channelMix.includes('cold_dm')) {
      contentSchemaParts.push(`    "cold_dm": [
      { "opener": "casual one-liner referencing something specific from their public profile", "body": "60-100 chars MAX, value-first not pitch-first", "ask": "low-bar ask, optional emoji, NEVER ask for a call in first DM" }
    ]`)
    }

    const contentSchema = contentSchemaParts.length ? contentSchemaParts.join(',\n') : '    /* (no channel selected) */'

    // Build phased calendar guidance based on campaign type.
    const campaignType = (campaign.campaign_type ?? 'awareness').toLowerCase()
    const arcMap: Record<string, { phases: string; postTypes: string; objective: string; ctaStyle: string }> = {
      product_launch: {
        objective: 'Drive launch-day awareness, demos, and first conversions for a new product/feature.',
        phases: 'Day 1-3 = pre_launch (teaser, build curiosity, "something is coming"); Day 4-5 = launch (announcement, hero post, demo video, founder POV); Day 6-10 = sustain (use cases, customer story, social proof, founder behind-the-scenes, comparison vs status quo); Day 11-14 = recap (results so far, FAQ, soft re-engagement, last-chance CTA).',
        postTypes: 'teaser, announcement, demo, founder_pov, use_case, social_proof, comparison, recap',
        ctaStyle: 'Strong, time-bound CTAs ("Book a demo", "Try it today", "Join the waitlist").',
      },
      lead_gen: {
        objective: 'Convert cold and warm prospects into booked meetings or trial signups.',
        phases: 'Day 1-3 = problem_framing (hook on the pain you solve, agitate the cost of doing nothing); Day 4-7 = solution (your wedge, proof points, mini case studies); Day 8-11 = proof (named customer wins, ROI numbers, objection-handlers); Day 12-14 = ask (clear CTAs, scarcity if real, soft re-engagement of non-responders).',
        postTypes: 'problem, agitate, solution, case_study, social_proof, objection_handler, ask, recap',
        ctaStyle: 'Direct conversion CTAs ("Book 15 min", "Get the playbook", "See pricing"). Every email and DM ends with one clear ask.',
      },
      nurture: {
        objective: 'Warm existing pipeline, stay top-of-mind, and move stuck deals forward without being pushy.',
        phases: 'Day 1-3 = value_share (insight, framework, or industry POV they will actually use); Day 4-7 = relevance (use case relevant to their stage / role / industry); Day 8-11 = peer_proof (similar customer story, before/after, named logos); Day 12-14 = soft_ask (re-open conversation with a low-friction next step).',
        postTypes: 'insight, framework, industry_pov, use_case, customer_story, before_after, peer_proof, soft_ask',
        ctaStyle: 'Low-friction, value-first CTAs ("Want the template?", "Worth a 10-min sync?", "Open to a quick walkthrough?"). Avoid "book a demo" until day 12+.',
      },
      awareness: {
        objective: 'Build brand visibility, establish category POV, and earn audience trust over 14 days.',
        phases: 'Day 1-3 = warm_up (industry POV, contrarian take, problem framing); Day 4-7 = peak (main narrative, value prop variations, founder voice); Day 8-11 = sustain (proof, mini case studies, user-generated quotes, behind-the-scenes); Day 12-14 = recap (engagement post, summary thread, soft CTA to follow / subscribe).',
        postTypes: 'industry_pov, contrarian, founder_pov, mini_case, behind_the_scenes, ugc_quote, recap, engagement_question',
        ctaStyle: 'Soft brand CTAs ("Follow for more", "Subscribe", "DM us your take"). Avoid hard sales asks.',
      },
    }
    const arc = arcMap[campaignType] ?? arcMap.awareness
    // The arcMap day ranges are written for a 14-day campaign. If the user
    // chose a different duration, instruct the LLM to compress/expand each
    // phase proportionally so the same narrative arc fits the actual length.
    const durationGuidance = durationDays === 14
      ? ''
      : `\nDURATION: This campaign is ${durationDays} days long (not 14). The PHASING above describes a 14-day arc — compress or expand each phase proportionally so the same narrative shape fits ${durationDays} days. e.g. for a 7-day campaign, halve every phase range; for a 30-day campaign, roughly double each phase range. Do NOT keep the literal day numbers from the PHASING text.`
    const phaseGuidance = `OBJECTIVE: ${arc.objective}
PHASING: ${arc.phases}${durationGuidance}
POST TYPES TO ROTATE: ${arc.postTypes}
CTA STYLE: ${arc.ctaStyle}`

    // Build a structured audience profile from enrolled prospects so the LLM can
    // tune positioning, hooks, hashtags, and subject lines to the actual ICP.
    const buildAudienceProfile = (rows: any[]): { summary: string; topIndustries: string[] } => {
      if (!rows.length) return { summary: 'No prospects enrolled yet — write to a generic ICP for this brand.', topIndustries: [] }

      const tally = (vals: (string | null | undefined)[]): [string, number][] => {
        const counts: Record<string, number> = {}
        for (const v of vals) {
          if (!v || typeof v !== 'string') continue
          const key = v.trim()
          if (!key) continue
          counts[key] = (counts[key] ?? 0) + 1
        }
        return Object.entries(counts).sort((a, b) => b[1] - a[1])
      }

      const total = rows.length
      const pct = (n: number) => `${Math.round((n / total) * 100)}%`

      // Seniority bucket from job_title
      const seniorityOf = (title: string | null | undefined): string => {
        const t = (title ?? '').toLowerCase()
        if (/\b(ceo|cto|cmo|cfo|coo|chief|founder|co-founder|owner|president)\b/.test(t)) return 'C-suite / Founder'
        if (/\bvp\b|vice president/.test(t)) return 'VP'
        if (/\b(director|head of)\b/.test(t)) return 'Director / Head'
        if (/\b(manager|lead|principal|sr\.|senior)\b/.test(t)) return 'Manager / Senior IC'
        if (t) return 'IC / Other'
        return 'Unknown'
      }

      // Company-size band from company_size string (handles "1-10", "50-200", "1000+", "Enterprise")
      const sizeBandOf = (sz: string | null | undefined): string => {
        const s = (sz ?? '').toLowerCase().replace(/[, ]/g, '')
        if (!s) return 'Unknown'
        const firstNum = parseInt(s.match(/\d+/)?.[0] ?? '0', 10)
        if (/enterprise/.test(s) || firstNum >= 1000) return 'Enterprise (1000+)'
        if (firstNum >= 200) return 'Mid-market (200-1000)'
        if (firstNum >= 50) return 'Growth (50-200)'
        if (firstNum >= 10) return 'SMB (10-50)'
        if (firstNum > 0) return 'Startup (1-10)'
        return 'Unknown'
      }

      const industries = tally(rows.map(r => r.industry)).slice(0, 5)
      const seniorities = tally(rows.map(r => seniorityOf(r.job_title))).slice(0, 4)
      const sizeBands = tally(rows.map(r => sizeBandOf(r.company_size))).slice(0, 4)
      const countries = tally(rows.map(r => r.country)).slice(0, 4)
      const titles = tally(rows.map(r => r.job_title)).slice(0, 6)

      const icpScores = rows.map(r => Number(r.icp_score)).filter(n => Number.isFinite(n) && n > 0)
      const avgIcp = icpScores.length ? (icpScores.reduce((a, b) => a + b, 0) / icpScores.length).toFixed(2) : null

      const fitReasons = rows
        .map(r => r.icp_fit_reason)
        .filter((r: any) => typeof r === 'string' && r.trim().length > 0)
        .slice(0, 3)

      const sampleCompanies = rows
        .map(r => r.company_name)
        .filter((c: any) => typeof c === 'string' && c.trim())
        .slice(0, 6)

      const fmt = (entries: [string, number][]) =>
        entries.map(([k, n]) => `${k} (${pct(n)})`).join(', ') || '(unknown)'

      const summary = [
        `${total} prospect(s) enrolled.`,
        `Top industries: ${fmt(industries)}.`,
        `Seniority mix: ${fmt(seniorities)}.`,
        `Company size: ${fmt(sizeBands)}.`,
        `Geo: ${fmt(countries)}.`,
        `Common titles: ${titles.map(([k]) => k).join('; ') || '(none)'}.`,
        sampleCompanies.length ? `Sample companies: ${sampleCompanies.join(', ')}.` : '',
        avgIcp ? `Average ICP fit score: ${avgIcp}.` : '',
        fitReasons.length ? `Why they fit: ${fitReasons.map((r: string) => `"${r.slice(0, 140)}"`).join(' | ')}` : '',
      ].filter(Boolean).join('\n             ')

      return { summary, topIndustries: industries.map(([k]) => k) }
    }

    const audience = buildAudienceProfile(prospects ?? [])
    const hasEnrolledProspects = (prospects ?? []).length > 0
    const prospectInsight = audience.summary
    const audienceIndustryHashtags = audience.topIndustries
      .slice(0, 3)
      .map(ind => '#' + ind.replace(/[^A-Za-z0-9]/g, ''))
      .filter(t => t.length > 1)

    // ───────────────────────────────────────────────────────────────────
    // GROUNDING HELPERS — every brand field captured at onboarding gets
    // surfaced here. Empty / missing fields render as "(not specified)" so
    // the LLM knows to lean on whatever it does have.
    // ───────────────────────────────────────────────────────────────────
    const arrField = (v: any): string[] => {
      if (Array.isArray(v)) return v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim())
      return []
    }
    const showList = (v: any, max = 8): string => {
      const a = arrField(v)
      if (!a.length) return '(none specified)'
      return a.slice(0, max).join(', ')
    }
    const showLines = (v: any, max = 5): string => {
      const a = arrField(v)
      if (!a.length) return '(none specified)'
      return a.slice(0, max).map(s => `  - ${s}`).join('\n')
    }
    const products = Array.isArray(brand.products_services) ? brand.products_services : []
    const productsBlock = products.length
      ? products.slice(0, 5).map((p: any, i: number) => `  ${i + 1}. ${p.name ?? '(unnamed)'}: ${(p.description ?? '').slice(0, 200)}`).join('\n')
      : '(none specified)'
    const voiceExamples = arrField(brand.voice_examples).slice(0, 3)
    const voiceExamplesBlock = voiceExamples.length
      ? voiceExamples.map((v: string, i: number) => `  Example ${i + 1}: "${v.slice(0, 240)}"`).join('\n')
      : '(none provided — infer voice from tone sliders below)'

    // Default ICP fallback: when no prospects are enrolled, build the audience
    // profile from the brand's onboarding-captured target market instead of
    // letting the LLM hallucinate a generic ICP.
    const defaultIcpBlock = (() => {
      const inds = arrField(brand.target_industries)
      const titles = arrField(brand.decision_maker_titles)
      const sizes = arrField(brand.target_company_sizes)
      const geos = arrField(brand.target_geographies)
      if (!inds.length && !titles.length && !sizes.length && !geos.length) {
        return 'No target market captured at onboarding. Write to a generic ICP relevant to the company description above.'
      }
      return [
        `No prospects are enrolled in this campaign — write to the brand's DEFAULT ICP captured at onboarding:`,
        inds.length ? `Target industries: ${inds.slice(0, 6).join(', ')}` : '',
        titles.length ? `Decision-maker titles: ${titles.slice(0, 8).join(', ')}` : '',
        sizes.length ? `Target company sizes: ${sizes.slice(0, 5).join(', ')}` : '',
        geos.length ? `Target geographies: ${geos.slice(0, 5).join(', ')}` : '',
      ].filter(Boolean).join('\n')
    })()

    // Channel-specific playbooks. Only the playbooks for channels actually in
    // scope get injected — keeps the prompt tight and the LLM focused.
    const channelPlaybooks: string[] = []
    if (channelMix.includes('linkedin_post')) {
      channelPlaybooks.push(`LINKEDIN_ORGANIC_POST_PLAYBOOK
- Hook is the first 3 lines visible before "see more" — must create a curiosity gap (a number, contrarian claim, or vivid moment), NOT a topic statement.
- Body: STRICTLY 1200-1500 characters. Count every character. Under 1200 = algorithm buries it; over 1500 = TLDR. 1-2 sentences per paragraph with a blank line between every paragraph (use \\n\\n in JSON). Walls of text die in feed.
- NEVER put external URLs in the post body — LinkedIn down-ranks posts with outbound links 6-10x. Output a separate "first_comment" field with the link or link teaser. The body should reference "Link in first comment ↓".
- NO hashtags in the first 100 characters. Place 3-5 hashtags at the very end only.
- End the post with an engagement question (drives comments → drives algorithm). The CTA goes in a separate paragraph above the question.
- One emoji max if brand allows; never in the hook.
- Numbers and specifics > vague claims ("47%" beats "huge lift").
- Each post entry MUST include: hook, body, cta, hashtags, AND a first_comment field (the website URL — use "${brand.website_url ?? 'https://gtmengine.qubitlyventures.com'}" unless a different landing page was specified; NEVER fabricate URLs like /demo or /icp-sample that may not exist).`)
    }
    if (channelMix.includes('linkedin_message')) {
      channelPlaybooks.push(`LINKEDIN_DM_PLAYBOOK
- NEVER open with "Hi {{first_name}}" alone. Reference one of: (a) something they recently posted, (b) a recent company announcement / promotion / job change, (c) a mutual connection, (d) a specific bio detail (school, prior role, location).
- Body 120-180 chars MAX. Anything longer feels like a sales pitch in DMs.
- Lead with relevance ("noticed you...") then bridge to value ("we help teams like yours...").
- NO links in the first message — LinkedIn deprioritizes message threads containing links.
- Ask: soft, low-friction, time-bounded. "Open to a 15-min chat next Tue or Wed?" beats "Want to learn more?"
- For C-suite recipients, ask for a reply ("worth a quick exchange?") not a meeting.
- Best send: Tue/Wed/Thu 7-9am their local TZ. Avoid Mon mornings (inbox flood) and Fri afternoons.`)
    }
    if (channelMix.includes('email')) {
      channelPlaybooks.push(`EMAIL_PLAYBOOK
- Output 2 subject line variants per email entry (subject = curiosity-driven, subject_b = direct/outcome-driven). Both under 55 chars (mobile preview cutoff). NO emojis, NO ALL CAPS, NO "free", NO "act now", NO "!" — these trigger spam filters.
- Preview text 60-90 chars. Must NOT repeat the subject. Treat it as a second hook.
- Body: 120-180 words, 3-4 short paragraphs, Problem-Agitate-Solve (PAS) framework.
- Mandatory PS line at the end (highest-read line in any email after subject).
- One CTA only. Anchor text uses an action verb — never say "click here".
- Output a "plain_text_body" field — same content but no HTML, bare URLs (cold B2B inboxes prefer plain-text — higher deliverability).
- Best send: Tue/Wed/Thu 10-11am or 13-15h recipient TZ. Avoid Mon, Fri, 1st/15th of month.`)
    }
    if (channelMix.includes('twitter') || channelMix.includes('twitter_x')) {
      channelPlaybooks.push(`TWITTER_X_PLAYBOOK
- Single tweet ≤ 280 chars: hook + payoff + soft CTA. The first 8 words MUST work as a quote-tweet — make them quotable on their own.
- For topics needing >280 chars, output a thread of 5-9 tweets:
  - Tweet 1: hook (curiosity gap, no "🧵" — that signal is dead in 2026)
  - Tweets 2-7: payoff (one idea per tweet, white space between concepts)
  - Final tweet: CTA + soft re-CTA ("Found this useful? Follow @handle for more.")
- Replies > likes for distribution. End the hook tweet with something controversial or askable.
- DON'T put external links in the hook tweet (suppressed). Put links in the LAST tweet only.
- Best post times: 12-13h, 17-18h, 20-22h local.`)
    }
    if (channelMix.includes('facebook_post') || channelMix.includes('facebook')) {
      channelPlaybooks.push(`FACEBOOK_ORGANIC_POST_PLAYBOOK
- Optimum length 80-120 words for organic Feed reach. Anything over 250 words gets truncated with "See more" and reach drops sharply.
- Hook in first 1-2 sentences (Facebook truncates to ~100 chars in mobile feed).
- One question per post — Facebook's algorithm rewards meaningful conversation in comments.
- Native video > image > link preview > external link. If you must link, paste the URL in a follow-up comment, not the body.
- Hashtags work modestly on Facebook (1-3 max, branded only — overuse looks spammy).
- Tag relevant Pages with @ when contextually natural (no tag-spam).
- Each entry MUST include: hook, body, cta, and an optional first_comment for any link.
- Best post times: Wed-Fri 9-11am or 13-15h local; Tue-Thu evenings 19-21h for B2C audiences.`)
    }
    if (channelMix.includes('cold_dm')) {
      channelPlaybooks.push(`COLD_DM_PLAYBOOK (Twitter/X DM, IG DM, etc.)
- Casual tone, no formal greeting ("hey [name]" max).
- 60-100 chars body MAX. Value-first not pitch-first.
- Reference something specific from their public profile or recent activity in opener.
- Low-bar ask, optional emoji. NEVER ask for a call in the first message.
- One link OK if value is obvious; otherwise zero links.`)
    }
    const playbookBlock = channelPlaybooks.length
      ? channelPlaybooks.join('\n\n')
      : '(no channel-specific playbooks for this channel mix)'

    // Constraints block — hard rules the LLM MUST honor.
    const constraintsLines: string[] = []
    const topicsAvoid = arrField(brand.topics_to_avoid)
    const phrasesAvoid = arrField(brand.phrases_to_avoid)
    const competitors = arrField(brand.competitor_names)
    if (topicsAvoid.length) constraintsLines.push(`NEVER write content touching these topics: ${topicsAvoid.join(', ')}.`)
    if (phrasesAvoid.length) constraintsLines.push(`NEVER use these phrases or close variants: ${phrasesAvoid.map(p => `"${p}"`).join(', ')}.`)
    if (competitors.length) constraintsLines.push(`NEVER name these competitors: ${competitors.join(', ')}.`)
    if ((brand as any).sensitivities) constraintsLines.push(`Cultural sensitivities to respect: ${(brand as any).sensitivities}`)
    const constraintsBlock = constraintsLines.length ? constraintsLines.map(l => `- ${l}`).join('\n') : '(no hard constraints)'

    const briefPrompt = `You are a senior B2B marketing strategist producing a publication-grade campaign brief.
Return ONLY valid JSON. No markdown, no code fences, no commentary.

# CLIENT
Company:        ${brand.company_name ?? 'Company'}
Industry:       ${brand.industry_sector ?? '(not specified)'}
Country:        ${brand.country_code ?? 'US'}
Company size:   ${brand.company_size ?? '(not specified)'}
Founded:        ${brand.founding_year ?? '(not specified)'}
Website:        ${brand.website_url ?? '(not specified)'}
Revenue model:  ${brand.revenue_model ?? '(not specified)'}

# POSITIONING (the wedge — anchor every piece of copy in this)
Pitch (1-line):     ${brand.one_sentence_pitch ?? '(not specified — infer from product list below)'}
Extended:           ${(brand.extended_description ?? '(not specified)').slice(0, 500)}
Products / services:
${productsBlock}
Differentiators ("Unlike X we Y"):
${showLines(brand.differentiators, 5)}
Proof points (metrics, named customers, outcomes):
${showLines(brand.proof_points, 5)}
Active themes:      ${showList(brand.active_themes, 6)}

# CAMPAIGN INTENT
Name:           ${campaign.name}
Type:           ${campaign.campaign_type ?? 'awareness'}
Goal (client's own words):  ${(campaign as any).goal ?? '(not specified — infer from type + positioning)'}
Key message:    ${(campaign as any).key_message ?? '(not specified — derive one from positioning)'}
Description:    ${(campaign as any).description ?? '(none)'}
Asset:          ${assetDescription}
Channels:       ${channelList}
Duration:       ${durationDays} days
Timezone:       ${timezone}

# AUDIENCE
${hasEnrolledProspects ? `Enrolled prospects from this campaign's ICP:\n${prospectInsight}` : defaultIcpBlock}

${audienceIndustryHashtags.length ? `Industry hashtag seed (use these or close variants in hashtag_sets.industry): ${audienceIndustryHashtags.join(', ')}` : ''}

# AUDIENCE-AWARENESS RULES
- Tune executive_summary, key_messages, and primary_cta to the dominant audience profile above.
- Hooks (LinkedIn posts, email subjects, Twitter opens) MUST reference pains specific to the top industry/seniority. Never write content that contradicts the audience profile.
- Email subjects: founders/CEOs prefer short + direct; VPs prefer outcome-driven; ICs prefer how-to.
- LinkedIn tone matches dominant seniority (founder/exec voice for C-suite audiences; practitioner voice for IC/manager audiences).
- DM openers must reference something true of the dominant prospect profile (industry, role, stage) — never generic "saw your profile".
- hashtag_sets.industry MUST include the seed industries above; hashtag_sets.regional MUST reflect the dominant geo above.

# BRAND VOICE (5 axes, 0-100)
Formal ↔ Conversational:        ${brand.tone_formal_conversational ?? 50}/100
Safe ↔ Bold:                    ${brand.tone_safe_bold ?? 50}/100
Corporate ↔ Human:              ${brand.tone_corporate_human ?? 50}/100
Data-driven ↔ Story-driven:     ${brand.tone_data_story ?? 50}/100
Conservative ↔ Provocative:     ${brand.tone_conservative_provocative ?? 50}/100
Sentence length:    ${brand.sentence_length ?? 'medium'}
Jargon:             ${brand.jargon_level ?? 'moderate'}
Emoji usage:        ${brand.emoji_usage ?? 'sparingly'}
CTA style:          ${brand.cta_style ?? 'direct'}
Voice examples (mimic the rhythm + word choice of these — NOT the topic):
${voiceExamplesBlock}

# CONSTRAINTS (hard rules — violating any of these invalidates the brief)
${constraintsBlock}

# CAMPAIGN ARC GUIDANCE
${phaseGuidance}

# CHANNEL PLAYBOOKS (follow these tactical rules per platform — they encode 2026 algorithm behavior)
${playbookBlock}

# RULES
- Every channel-content piece must reference the asset or its core promise concretely (no generic "exciting product" copy).
- TONE: When targeting marketing leaders (CMO, VP Marketing, Growth Lead), do NOT imply they are replaceable or that their team is unnecessary. Frame the value as amplification and automation of tedious work, not replacement. "Your team, 10x faster" not "Your team, not needed."
- Vary post times across the day per channel (do NOT use the same time for every entry).
- ${workingDaysOnly ? 'Skip Saturday & Sunday entirely — only include working days (Mon-Fri) in the schedule.' : 'Weekends are allowed — distribute posts across all 7 days.'}
- Hashtags: branded must include a campaign-specific tag derived from the campaign name; provide 8-15 unique hashtags total across categories.
- Honour brand voice and the # CONSTRAINTS block above. Constraint violations invalidate the brief.
- Channel-specific tactical rules from the # CHANNEL PLAYBOOKS block ABOVE override generic rules.

# REQUIRED JSON SHAPE
{
  "executive_summary": "2-3 sentence positioning that ties the asset to the campaign goal and target audience",
  "executive_summary_rationale": "2-4 sentence explanation of WHY this brief was built this way. Must reference at least one positioning element (pitch / differentiator / proof point), at least one audience trait (industry / seniority / geo), and the campaign goal/key_message. This is shown to the client to answer 'is this for me?'",
  "key_messages": ["3-5 sharp positioning lines, each <= 140 chars"],
  "primary_cta": "the single most important action you want the audience to take",
  "posting_schedule": [
    {
      "day": 1,
      "recommended_date": "YYYY-MM-DD",
      "phase": "the phase label for this day from the PHASING section above (e.g. pre_launch, launch, sustain, recap, problem_framing, solution, proof, ask, value_share, relevance, peer_proof, soft_ask, warm_up, peak)",
      "channel": "one of the channels in scope",
      "post_type": "teaser | announcement | use_case | founder_pov | social_proof | comparison | recap | educational",
      "theme": "5-8 word title for this post",
      "hook": "the opening line idea for this specific post",
      "time_local": "HH:MM ${timezone}",
      "time_utc": "HH:MM"
    }
  ],
  "content": {
${contentSchema}
  },
  "hashtag_sets": {
    "branded":  ["#CompanyName", "#CampaignSpecificTag"],
    "industry": ["#YourIndustry1", "#YourIndustry2", "#YourIndustry3"],
    "general":  ["#B2B", "#GTM"],
    "niche":    ["#NicheTopic1", "#NicheTopic2"],
    "regional": ["#${(brand.country_code ?? 'US').toUpperCase()}Tech"]
  },
  "timing_recommendations": {
    "linkedin_post":    { "best_days": ["Tue","Wed","Thu"], "best_times": ["07:30-09:00","17:00-18:00"], "rationale": "why these slots work for LinkedIn organic reach" },
    "email":            { "best_days": ["Tue","Wed","Thu"], "best_times": ["10:00-11:00","13:00-15:00"], "rationale": "open + click windows for B2B inbox" },
    "twitter":          { "best_days": ["Tue","Wed","Thu","Fri"], "best_times": ["12:00-13:00","17:00-18:00","20:00-22:00"], "rationale": "lunch / commute / evening engagement spikes" },
    "linkedin_message": { "best_days": ["Tue","Wed","Thu"], "best_times": ["09:00-11:00","14:00-16:00"], "rationale": "highest InMail response rates" },
    "cold_dm":          { "best_days": ["Tue","Wed"], "best_times": ["10:00-12:00"], "rationale": "before mid-day distraction" }
  }
}

Generate exactly ${durationDays} schedule entries. ${scheduleDatesNote}
Each schedule entry's recommended_date MUST match the date list above exactly — do NOT invent your own dates.
Generate exactly ${durationDays} variants per channel under "content" — one content variant per schedule day, so each day has its own copy.
Generate at least 8 hashtags total across the sets.
Only include "timing_recommendations" entries for channels in scope: ${channelList}.`

    // copies_only mode: skip the brief LLM call + PDF generation entirely and
    // reuse the campaign's existing brief_data. Only the per-prospect copy loop
    // below will run. Used to backfill outreach_copies after the unique-index
    // fix without paying for another brief regeneration.
    let briefData: BriefData | null = null
    let pdfBytes: Uint8Array | null = null

    function extractJSONObject(raw: string): string {
      // Try direct parse first
      try { JSON.parse(raw); return raw } catch {}
      // Strip markdown code fences
      const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
      if (fenceMatch) {
        const inner = fenceMatch[1].trim()
        try { JSON.parse(inner); return inner } catch {}
      }
      // Find outermost { ... } — handles thinking/reasoning text before/after JSON
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start !== -1 && end > start) {
        const candidate = raw.slice(start, end + 1)
        try { JSON.parse(candidate); return candidate } catch {}
        // Try fixing trailing commas before closing brackets
        const fixed = candidate.replace(/,\s*([}\]])/g, '$1')
        try { JSON.parse(fixed); return fixed } catch {}
      }
      return raw
    }

    if (!body.copies_only) {
      let briefRaw: string | null = null
      let briefParseAttempts = 0
      const MAX_PARSE_ATTEMPTS = 2

      while (briefParseAttempts < MAX_PARSE_ATTEMPTS) {
        briefParseAttempts++
        const result = await routeTextGeneration(
          providerKey,
          modelId,
          [{ role: 'user', content: briefPrompt }],
          apiKey,
          orgId,
          orgSlug,
          null,
          'campaign_brief',
          { responseFormat: { type: 'json_object' } },
        )

        try {
          const extracted = extractJSONObject(result)
          briefData = JSON.parse(extracted)
          briefRaw = result
          break // success
        } catch (parseErr) {
          console.error(`brief_parse_failed (attempt ${briefParseAttempts}). Raw response (first 2000 chars):`, result.slice(0, 2000))
          if (briefParseAttempts >= MAX_PARSE_ATTEMPTS) {
            return new Response(JSON.stringify({ error: 'brief_parse_failed', detail: (parseErr as Error).message, raw_preview: result.slice(0, 500) }), {
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          // Retry — re-invoke the LLM
          continue
        }
      }

      // Back-compat shims so the existing /campaigns/[id] Calendar tab keeps rendering.
      const allHashtags: string[] = []
      const sets = briefData!.hashtag_sets ?? {}
      for (const k of ['branded', 'industry', 'general', 'niche', 'regional'] as const) {
        const arr = (sets as any)[k]
        if (Array.isArray(arr)) for (const t of arr) if (typeof t === 'string' && !allHashtags.includes(t)) allHashtags.push(t)
      }
      if (allHashtags.length) (briefData as any).hashtags = allHashtags

      const flatTimes: Record<string, string> = {}
      for (const [ch, rec] of Object.entries(briefData!.timing_recommendations ?? {})) {
        if (typeof rec === 'string') flatTimes[ch] = rec
        else if (rec && typeof rec === 'object') {
          const days = (rec.best_days ?? []).join('/')
          const times = (rec.best_times ?? []).join(', ')
          flatTimes[ch] = [days, times].filter(Boolean).join(' · ')
        }
      }
      if (Object.keys(flatTimes).length) (briefData as any).best_time_to_post = flatTimes

      // Stash audience profile on the brief so PDF + frontend can render it.
      ;(briefData as any).audience_profile = {
        total: (prospects ?? []).length,
        summary: prospectInsight,
        top_industries: audience.topIndustries,
      }

      // Generate PDF using pdf-lib
      pdfBytes = await generatePdf(
        briefData!,
        brand,
        { asset_type: job?.asset_type, prompt_tags: job?.content_job_json?.prompt_tags },
        campaign.name ?? 'Campaign Brief',
        durationDays,
      )
    }

    // Generate outreach copies per prospect per channel
    let copyCount = 0
    const successfulProspectIds = new Set<string>()
    for (const prospect of prospects ?? []) {
      for (const channel of channelMix) {
        try {
          const copyPrompt = `Write a short personalised outreach message.
Platform: ${channel}
Prospect: ${(prospect as any).first_name ?? ''} ${(prospect as any).last_name ?? ''}, ${(prospect as any).title ?? 'Professional'} at ${(prospect as any).company_name ?? 'their company'}
Campaign: ${campaign.name}
Brand voice: ${(brand.voice_examples ?? [])[0]?.slice(0, 200) ?? 'Professional and direct'}
Return ONLY the message text.`
          const copyText = await routeTextGeneration(
            providerKey, modelId, [{ role: 'user', content: copyPrompt }],
            apiKey, orgId, orgSlug, null, 'outreach_copy',
          )
          const { error: upsertErr } = await db.from('outreach_copies').upsert({
            org_id: orgId,
            campaign_id,
            prospect_id: (prospect as any).id,
            job_id: jobId ?? null,
            copy_text: copyText.trim(),
            platform: channel,
            status: 'draft',
          }, { onConflict: 'org_id,campaign_id,prospect_id,platform', ignoreDuplicates: false })
          if (upsertErr) {
            console.error('outreach_copies upsert failed:', upsertErr.message, { campaign_id, prospect_id: (prospect as any).id, platform: channel })
            continue
          }
          copyCount++
          successfulProspectIds.add((prospect as any).id)
        } catch (e) {
          console.error('outreach copy generation failed:', (e as Error)?.message, { campaign_id, prospect_id: (prospect as any).id, platform: channel })
        }
      }
    }

    // Auto-advance prospect status: new -> contacted (do NOT overwrite manual statuses
    // like replied/qualified/disqualified). Mirrors the personalise function's behaviour
    // so a prospect's lifecycle stays in sync whether outreach is generated 1-by-1 or
    // in bulk via a campaign brief.
    //
    // Two-pass:
    //   1. Always stamp last_contacted_at + contacted_via='campaign' + last_campaign_id
    //      for EVERY prospect that got a copy (even if status is already past 'new').
    //      This keeps the "last touched" timeline accurate on re-runs.
    //   2. Promote status 'new' -> 'contacted' only.
    if (successfulProspectIds.size > 0) {
      const ids = Array.from(successfulProspectIds)
      const now = new Date().toISOString()

      // Pass 1: attribution + timestamp (all touched prospects)
      await db.from('prospects')
        .update({
          contacted_via: 'campaign',
          last_contacted_at: now,
          last_campaign_id: campaign_id,
          updated_at: now,
        })
        .in('id', ids)
        .eq('org_id', orgId)

      // Pass 2: lifecycle promotion (only those still at 'new')
      await db.from('prospects')
        .update({ status: 'contacted' })
        .in('id', ids)
        .eq('org_id', orgId)
        .eq('status', 'new')
    }

    // Upload PDF to storage (use campaign_id as filename for idempotency)
    const storagePath = `${orgId}/${campaign_id}.pdf`

    if (!body.copies_only && pdfBytes) {
      // Upload PDF to storage
      const { error: uploadErr } = await db.storage
        .from('briefs')
        .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })

      if (uploadErr) {
        console.error('PDF upload failed:', uploadErr.message)
        return new Response(JSON.stringify({ error: 'pdf_upload_failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Update existing campaign_briefs row (do NOT insert new).
    // copies_only mode: only stamp updated_at + auto-promote draft->active; never
    // overwrite brief_data / pdf_url. Otherwise: write the freshly generated brief.
    await db.from('campaign_briefs')
      .update({
        ...(body.copies_only ? {} : { brief_data: briefData, pdf_url: storagePath }),
        updated_at: new Date().toISOString(),
        ...(jobId ? { job_id: jobId } : {}),
        ...(campaign.status === 'draft' ? { status: 'active' } : {}),
      })
      .eq('id', campaign_id)

    const channelSummary: Record<string, number> = {}
    for (const ch of channelMix) channelSummary[ch] = (prospects ?? []).length

    return new Response(
      JSON.stringify({
        brief_id: campaign_id,
        pdf_url: storagePath,
        copy_count: copyCount,
        channel_summary: channelSummary,
      }),
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
    console.error('generate-campaign-brief error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
