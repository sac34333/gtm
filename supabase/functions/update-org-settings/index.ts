import { createServiceClient } from '../_shared/db.ts'
import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'

const ALLOWED_FREQUENCIES = ['daily', 'every_2_days', 'every_3_days', 'every_5_days', 'monthly']

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()
    await requireRole(orgId, user.id, 'admin', db)

    // Validate body size
    const contentLength = parseInt(req.headers.get('content-length') ?? '0')
    if (contentLength > 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      })
    }

    const body = await req.json()
    const { signal_ingestion_enabled, signal_ingestion_frequency } = body

    // Validate frequency if provided
    if (signal_ingestion_frequency !== undefined) {
      if (!ALLOWED_FREQUENCIES.includes(signal_ingestion_frequency)) {
        return new Response(
          JSON.stringify({
            error: 'invalid_frequency',
            allowed: ALLOWED_FREQUENCIES,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } },
        )
      }
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {}
    if (signal_ingestion_enabled !== undefined) {
      updatePayload.signal_ingestion_enabled = Boolean(signal_ingestion_enabled)
    }
    if (signal_ingestion_frequency !== undefined) {
      updatePayload.signal_ingestion_frequency = signal_ingestion_frequency
    }

    // Get current org state
    const { data: org, error: orgError } = await db
      .from('orgs')
      .select('last_signal_ingestion_at')
      .eq('id', orgId)
      .single()

    if (orgError) throw orgError

    // Update orgs
    const { error: updateError } = await db
      .from('orgs')
      .update(updatePayload)
      .eq('id', orgId)

    if (updateError) throw updateError

    // If enabling ingestion for the first time → trigger immediate ingest
    let triggeredImmediateIngest = false
    if (signal_ingestion_enabled === true && !org.last_signal_ingestion_at) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
        await fetch(`${supabaseUrl}/functions/v1/ingest-signals`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'x-cron-secret': cronSecret,
            'Content-Type': 'application/json',
          },
        })
        triggeredImmediateIngest = true
      } catch (err) {
        console.error('Failed to trigger immediate ingest:', err)
        // Don't fail the request — immediate ingest is best-effort
      }
    }

    return new Response(
      JSON.stringify({ updated: true, triggered_immediate_ingest: triggeredImmediateIngest }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('update-org-settings error:', err)
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    })
  }
})
