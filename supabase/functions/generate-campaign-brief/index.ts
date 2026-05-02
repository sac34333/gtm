import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { resolveApiKey, routeTextGeneration } from '../_shared/providers/router.ts'

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

async function generatePdf(brief: BriefData, brand: any, job: any): Promise<Uint8Array> {
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
  writeText(`Asset: ${job.asset_type ?? 'image'} — ${job.prompt_tags?.subject ?? 'Campaign Asset'}`, MARGIN, 11)
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
  ;(brief.caption_variants?.primary_platform ?? []).forEach((caption: string, i: number) => {
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
  ;(brief.caption_variants?.secondary_platform ?? []).forEach((caption: string, i: number) => {
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

    const body = await req.json()
    const { job_id, prospect_ids = [] } = body

    if (!job_id || typeof job_id !== 'string') {
      return new Response(JSON.stringify({ error: 'job_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!Array.isArray(prospect_ids) || prospect_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'prospect_ids required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch generation job
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

    // Fetch approved outreach copies
    const { data: copies } = await db
      .from('outreach_copies')
      .select('*')
      .eq('org_id', orgId)
      .eq('job_id', job_id)
      .eq('status', 'approved')
      .in('prospect_id', prospect_ids)

    // Fetch org slug
    const { data: org } = await db
      .from('orgs')
      .select('slug')
      .eq('id', orgId)
      .single()
    const orgSlug = (org as any)?.slug ?? ''

    // Resolve text model for campaign_brief step
    let providerKey = 'openrouter'
    let modelId = 'google/gemini-flash-1.5'

    const { data: modelPref } = await db
      .from('org_model_preferences')
      .select('provider_key, model_id')
      .eq('org_id', orgId)
      .eq('step_key', 'campaign_brief')
      .single()

    if (modelPref) {
      providerKey = modelPref.provider_key
      modelId = modelPref.model_id
    } else {
      const { data: defaultModel } = await db
        .from('available_models')
        .select('provider_key, model_id')
        .eq('step_key', 'campaign_brief')
        .eq('is_default', true)
        .single()
      if (defaultModel) {
        providerKey = defaultModel.provider_key
        modelId = defaultModel.model_id
      }
    }

    const apiKey = await resolveApiKey(orgId, providerKey)

    const contentJob = job.content_job_json ?? {}
    const promptTags = job.prompt_tags ?? {}

    // Generate brief content via AI
    const briefPrompt = `Create a 14-day campaign brief for the following B2B marketing campaign.
Return ONLY valid JSON, no markdown, no explanation.

Company: ${brand.company_name ?? 'Company'}
Campaign asset: ${job.asset_type ?? 'image'} — ${promptTags.subject ?? 'Campaign Asset'}
Trend: ${contentJob.signal_headline ?? 'Trending topic'}
Primary platform: ${brand.primary_platform ?? 'LinkedIn'}
Secondary platform: ${brand.secondary_platform ?? 'Twitter'}
Timezone: ${brand.timezone ?? 'UTC'}
Posts per week: ${brand.posts_per_week ?? 3}
Country code: ${brand.country_code ?? 'US'}

Generate a JSON object with this exact structure:
{
  "posting_schedule": [
    {"recommended_date": "YYYY-MM-DD", "platform": "LinkedIn", "time_utc": "09:00", "time_local": "09:00 EST"}
  ],
  "caption_variants": {
    "primary_platform": ["caption 1", "caption 2", "caption 3"],
    "secondary_platform": ["caption 1", "caption 2", "caption 3"]
  },
  "hashtag_sets": {
    "general": ["#hashtag1", "#hashtag2"],
    "regional": ["#regional1", "#regional2"]
  },
  "timing_recommendations": {
    "LinkedIn": "Best posting times for this audience",
    "Twitter": "Best posting times for this audience"
  }
}

Generate 14 days of posting schedule starting from today ${new Date().toISOString().slice(0, 10)}.
Each day should have 1 post alternating between primary and secondary platforms.`

    const briefRaw = await routeTextGeneration(
      providerKey,
      modelId,
      [{ role: 'user', content: briefPrompt }],
      apiKey,
      orgId,
      orgSlug,
      job_id,
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
    const pdfBytes = await generatePdf(briefData, brand, job)

    // Create brief record to get ID
    const { data: briefRecord, error: briefErr } = await db
      .from('campaign_briefs')
      .insert({
        org_id: orgId,
        job_id,
        brief_data: briefData,
        name: `${brand.company_name ?? 'Campaign'} Brief — ${new Date().toISOString().slice(0, 10)}`,
        status: 'active',
      })
      .select('id')
      .single()

    if (briefErr || !briefRecord) {
      console.error('campaign_briefs insert failed:', briefErr?.message)
      return new Response(JSON.stringify({ error: 'failed_to_save_brief' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const briefId = briefRecord.id
    const storagePath = `briefs/${orgId}/${briefId}.pdf`

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

    // Update brief with PDF URL
    await db.from('campaign_briefs')
      .update({ pdf_url: storagePath })
      .eq('id', briefId)

    return new Response(
      JSON.stringify({ brief_id: briefId, pdf_url: storagePath }),
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
