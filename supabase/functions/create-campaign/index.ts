import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { CreateCampaignBodySchema } from '../_shared/schemas.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    // Any org member can create campaigns
    await requireRole(orgId, user.id, 'member', db)

    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawBody = await req.json()
    const parseResult = CreateCampaignBodySchema.safeParse(rawBody)
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'validation_failed', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = parseResult.data

    const { data: campaign, error } = await db
      .from('campaign_briefs')
      .insert({
        org_id: orgId,
        name: body.name,
        status: 'draft',
        campaign_type: body.campaign_type,
        description: body.description ?? null,
        goal: body.goal ?? null,
        key_message: body.key_message ?? null,
        channel_mix: body.channel_mix ?? ['linkedin_message', 'email'],
        start_date: body.start_date ?? null,
        end_date: body.end_date ?? null,
        job_id: body.job_id ?? null,
        ...(body.duration_days !== undefined ? { duration_days: body.duration_days } : {}),
        ...(body.working_days_only !== undefined ? { working_days_only: body.working_days_only } : {}),
      })
      .select('id')
      .single()

    if (error || !campaign) {
      console.error('create-campaign insert failed:', error?.message)
      return new Response(JSON.stringify({ error: 'failed_to_create_campaign' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ campaign_id: campaign.id }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('create-campaign error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
