import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { AddCampaignProspectsBodySchema } from '../_shared/schemas.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    await requireRole(orgId, user.id, 'member', db)

    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawBody = await req.json()
    const parseResult = AddCampaignProspectsBodySchema.safeParse(rawBody)
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'validation_failed', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { campaign_id, prospect_ids } = parseResult.data

    // Validate campaign belongs to org
    const { data: campaign } = await db
      .from('campaign_briefs')
      .select('id')
      .eq('id', campaign_id)
      .eq('org_id', orgId)
      .single()

    if (!campaign) {
      return new Response(JSON.stringify({ error: 'campaign_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate all prospects belong to org
    const { data: validProspects } = await db
      .from('prospects')
      .select('id')
      .in('id', prospect_ids)
      .eq('org_id', orgId)

    const validIds = (validProspects ?? []).map((p: any) => p.id)

    const rows = validIds.map((pid: string) => ({
      org_id: orgId,
      campaign_id,
      prospect_id: pid,
    }))

    let added = 0
    let skipped = 0

    if (rows.length > 0) {
      // Bulk insert with ON CONFLICT DO NOTHING (unique constraint on campaign_id + prospect_id)
      const { data: inserted } = await db
        .from('campaign_prospects')
        .upsert(rows, { onConflict: 'campaign_id,prospect_id', ignoreDuplicates: true })
        .select('id')

      added = (inserted ?? []).length
      skipped = rows.length - added
    }

    return new Response(
      JSON.stringify({ added, skipped, invalid: prospect_ids.length - validIds.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('add-campaign-prospects error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
