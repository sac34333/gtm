import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { InviteUserBodySchema } from '../_shared/schemas.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    await requireRole(orgId, user.id, 'admin', db)

    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawBody = await req.json()
    const parseResult = InviteUserBodySchema.safeParse(rawBody)
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'validation_failed', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { email, role } = parseResult.data

    // Seat limit check
    const { data: org } = await db
      .from('orgs')
      .select('seat_limit, name')
      .eq('id', orgId)
      .single()

    const { count: seatCount } = await db
      .from('org_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('status', ['active', 'pending'])

    if (seatCount !== null && org && seatCount >= org.seat_limit) {
      return new Response(JSON.stringify({ error: 'seat_limit_reached' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://gtmengine.qubitlyventures.com'

    // Admin auth client for inviteUserByEmail
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${appUrl}/onboarding`,
        data: { org_id: orgId, invited_role: role },
      },
    )

    if (inviteError) {
      console.error('invite-user inviteUserByEmail failed:', inviteError.message)
      return new Response(JSON.stringify({ error: 'invite_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Upsert org_members row (invited state)
    await db
      .from('org_members')
      .upsert(
        {
          org_id: orgId,
          user_id: inviteData.user.id,
          role,
          status: 'pending',
          invited_by: user.id,
          email,
        },
        { onConflict: 'org_id,user_id', ignoreDuplicates: false },
      )

    return new Response(
      JSON.stringify({ invited: true, email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('invite-user error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
