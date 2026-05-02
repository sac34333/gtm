import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { UpdateCampaignBodySchema } from '../_shared/schemas.ts'

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
    const parseResult = UpdateCampaignBodySchema.safeParse(rawBody)
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'validation_failed', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { campaign_id, ...updates } = parseResult.data

    // Verify campaign belongs to org
    const { data: existing } = await db
      .from('campaign_briefs')
      .select('id')
      .eq('id', campaign_id)
      .eq('org_id', orgId)
      .single()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'campaign_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build update object — only include defined fields
    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    const allowedFields = [
      'name', 'status', 'campaign_type', 'description',
      'channel_mix', 'start_date', 'end_date', 'job_id',
    ] as const

    for (const field of allowedFields) {
      if (field in updates && updates[field] !== undefined) {
        updateFields[field] = updates[field]
      }
    }

    const { error } = await db
      .from('campaign_briefs')
      .update(updateFields)
      .eq('id', campaign_id)
      .eq('org_id', orgId)

    if (error) {
      console.error('update-campaign error:', error.message)
      return new Response(JSON.stringify({ error: 'update_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ updated: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('update-campaign error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
