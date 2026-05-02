import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { resolveApiKey, routeTextGeneration } from '../_shared/providers/router.ts'
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
  recommended_date: string
  platform: string
  time_utc: string
  time_local: string
}

interface BriefData {
  posting_schedule: PostingDay[]
  caption_variants: { primary_platform: string[]; secondary_platform: string[] }
  hashtag_sets: { general: string[]; regional: string[] }
  timing_recommendations: Record<string, string>
}

async function generatePdf(brief: BriefData, brand: any, campaignInfo: any): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import('npm:pdf-lib')

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const addPage = () => {
    const page = pdfDoc.addPage([595, 842]) // A4
    return page
  }

  const MARGIN = 50
  const PAGE_WIDTH = 595
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
  const LINE_H = 16
  const SECTION_GAP = 20

  let page = addPage()
  let y = 792

  const writeText = (text: string, x: number, size: number, isBold = false, color = rgb(0, 0, 0)) => {
    if (y < 60) {
      page = addPage()
      y = 792
    }
    page.drawText(text.slice(0, 100), { x, y, size, font: isBold ? boldFont : font, color })
    y -= LINE_H
  }

  const writeLine = () => { y -= 4 }
  const writeSection = (title: string) => {
    y -= SECTION_GAP
    writeText(title, MARGIN, 13, true, rgb(0.18, 0.22, 0.78))
    writeText('─'.repeat(60), MARGIN, 8, false, rgb(0.7, 0.7, 0.7))
  }

  // Header
  writeText(`Campaign Brief — ${brand.company_name ?? 'Your Company'}`, MARGIN, 18, true)
  writeLine()
  writeText(`Asset: ${campaignInfo?.asset_type ?? 'image'} — ${campaignInfo?.prompt_tags?.subject ?? 'Campaign Asset'}`, MARGIN, 11)
  writeText(`Generated: ${new Date().toLocaleDateString()}`, MARGIN, 10, false, rgb(0.4, 0.4, 0.4))
  writeLine()

  // Posting schedule
  writeSection('14-Day Posting Schedule')
  for (const day of (brief.posting_schedule ?? []).slice(0, 14)) {
    writeText(
      `${day.recommended_date}  |  ${day.platform}  |  ${day.time_local} local  |  ${day.time_utc} UTC`,
      MARGIN + 10, 10,
    )
  }

  // Caption variants — primary platform
  const primaryPlatform = brand.primary_platform ?? 'LinkedIn'
  writeSection(`Caption Variants — ${primaryPlatform}`)
  const primaryCaptions: string[] = (brief.caption_variants as any)?.[primaryPlatform] ??
    Object.values(brief.caption_variants ?? {})?.[0] as string[] ?? []
  primaryCaptions.forEach((caption: string, i: number) => {
    writeText(`Option ${i + 1}:`, MARGIN + 10, 10, true)
    // Word-wrap long captions
    const words = caption.split(' ')
    let line = ''
    for (const word of words) {
      if ((line + word).length > 80) {
        writeText(line.trim(), MARGIN + 20, 10)
        line = word + ' '
      } else {
        line += word + ' '
      }
    }
    if (line.trim()) writeText(line.trim(), MARGIN + 20, 10)
    writeLine()
  })

  // Caption variants — secondary platform
  const secondaryPlatform = brand.secondary_platform ?? 'Twitter'
  writeSection(`Caption Variants — ${secondaryPlatform}`)
  const secondaryCaptions: string[] = (brief.caption_variants as any)?.[secondaryPlatform] ??
    Object.values(brief.caption_variants ?? {})?.[1] as string[] ?? []
  secondaryCaptions.forEach((caption: string, i: number) => {
    writeText(`Option ${i + 1}: ${caption.slice(0, 90)}`, MARGIN + 10, 10)
    writeLine()
  })

  // Hashtags
  writeSection('Hashtags')
  writeText('General:', MARGIN + 10, 10, true)
  writeText((brief.hashtag_sets?.general ?? []).join('  '), MARGIN + 20, 9)
  writeLine()
  writeText('Regional:', MARGIN + 10, 10, true)
  writeText((brief.hashtag_sets?.regional ?? []).join('  '), MARGIN + 20, 9)

  // Timing recommendations
  writeSection('Timing Recommendations')
  for (const [platform, rec] of Object.entries(brief.timing_recommendations ?? {})) {
    writeText(`${platform}: ${String(rec).slice(0, 80)}`, MARGIN + 10, 10)
  }

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
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

    let prospectIds: string[] = body.prospect_ids ?? []
    if (prospectIds.length === 0) {
      const { data: cpRows } = await db.from('campaign_prospects')
        .select('prospect_id').eq('campaign_id', campaign_id).eq('org_id', orgId)
      prospectIds = (cpRows ?? []).map((r: any) => r.prospect_id)
    }

    const { data: prospects } = prospectIds.length
      ? await db.from('prospects').select('*').in('id', prospectIds).eq('org_id', orgId)
      : { data: [] }

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

    const briefPrompt = `Create a 14-day B2B marketing campaign brief. Return ONLY valid JSON, no markdown.

Company: ${brand.company_name ?? 'Company'}
Campaign: ${campaign.name}
Type: ${campaign.campaign_type ?? 'awareness'}
Asset: ${assetDescription}
Channels: ${channelList}
Timezone: ${timezone}
Country: ${brand.country_code ?? 'US'}
Themes: ${(brand.active_themes ?? []).join(', ')}

Return exactly this JSON structure:
{
  "posting_schedule": [
    {"recommended_date": "YYYY-MM-DD", "platform": "channel_name", "time_utc": "HH:MM", "time_local": "HH:MM TZ"}
  ],
  "caption_variants": {
    ${channelMix.map((ch: string) => `"${ch}": ["caption1", "caption2", "caption3"]`).join(',\n    ')}
  },
  "hashtag_sets": {
    "general": ["#tag1", "#tag2", "#tag3"],
    "industry": ["#industry1", "#industry2"],
    "regional": ["#regional1"]
  },
  "timing_recommendations": {
    ${channelMix.map((ch: string) => `"${ch}": "Best days/times for this channel"`).join(',\n    ')}
  }
}
Generate exactly 14 schedule entries starting ${new Date().toISOString().slice(0, 10)}.`

    const briefRaw = await routeTextGeneration(
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

    let briefData: BriefData
    try {
      // Strip markdown code fences if present
      const cleaned = briefRaw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
      briefData = JSON.parse(cleaned)
    } catch {
      return new Response(JSON.stringify({ error: 'brief_parse_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate PDF using pdf-lib
    const pdfBytes = await generatePdf(briefData, brand, { asset_type: job?.asset_type, prompt_tags: job?.content_job_json?.prompt_tags })

    // Generate outreach copies per prospect per channel
    let copyCount = 0
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
          await db.from('outreach_copies').upsert({
            org_id: orgId,
            campaign_id,
            prospect_id: (prospect as any).id,
            job_id: jobId ?? null,
            copy_text: copyText.trim(),
            platform: channel,
            status: 'draft',
          }, { onConflict: 'org_id,campaign_id,prospect_id,platform', ignoreDuplicates: false })
          copyCount++
        } catch { /* continue on individual copy failure */ }
      }
    }

    // Upload PDF to storage (use campaign_id as filename for idempotency)
    const storagePath = `briefs/${orgId}/${campaign_id}.pdf`

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

    // Update existing campaign_briefs row (do NOT insert new)
    await db.from('campaign_briefs')
      .update({
        brief_data: briefData,
        pdf_url: storagePath,
        updated_at: new Date().toISOString(),
        ...(jobId ? { job_id: jobId } : {}),
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
    console.error('generate-campaign-brief error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
