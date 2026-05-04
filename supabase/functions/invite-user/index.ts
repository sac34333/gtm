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

    const appUrl = Deno.env.get('APP_URL') ?? 'https://gtmengine.qubitlyventures.com'

    // Admin auth client for inviteUserByEmail / generateLink
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Look up existing auth.users row for this email (if any)
    let targetUserId: string | null = null
    {
      const { data: existingId } = await db.rpc('admin_get_user_id_by_email', { p_email: email })
      if (existingId) targetUserId = existingId as string
    }

    // Check whether this email is ALREADY a member of THIS org (any status)
    // If so, this is a resend flow — skip the seat reservation.
    let isResend = false
    if (targetUserId) {
      const { data: existingMembership } = await db
        .from('org_members')
        .select('org_id, status')
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (existingMembership) {
        if (existingMembership.org_id === orgId) {
          if (existingMembership.status === 'active') {
            return new Response(JSON.stringify({ error: 'already_member' }), {
              status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          isResend = true
        } else if (existingMembership.status === 'active') {
          return new Response(JSON.stringify({ error: 'user_in_other_org' }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Atomic seat check via row-locked RPC (only for fresh invites, not resends).
    // Prevents two concurrent invites from both passing when only 1 seat is free.
    if (!isResend) {
      const { data: hasSeat, error: reserveError } = await db.rpc('try_reserve_seat', { p_org_id: orgId })
      if (reserveError) {
        console.error('try_reserve_seat error:', reserveError.message)
        return new Response(JSON.stringify({ error: 'internal_error' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!hasSeat) {
        return new Response(JSON.stringify({ error: 'seat_limit_reached' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (targetUserId) {
      await db
        .from('org_members')
        .upsert(
          {
            org_id: orgId,
            user_id: targetUserId,
            role,
            status: 'pending',
            invited_by: user.id,
            email,
          },
          { onConflict: 'org_id,user_id', ignoreDuplicates: false },
        )

      // Generate a fresh invite magic link
      const { error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
          redirectTo: `${appUrl}/invite/accept`,
          data: { org_id: orgId, invited_role: role },
        },
      })

      if (linkError) {
        const lower = linkError.message?.toLowerCase() ?? ''
        let code = 'invite_failed'
        if (lower.includes('rate') || lower.includes('limit')) code = 'rate_limit'
        else if (lower.includes('invalid') && lower.includes('email')) code = 'email_address_invalid'
        return new Response(JSON.stringify({ error: code, detail: linkError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(
        JSON.stringify({ invited: true, email, resent: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fresh invite — no existing auth.users row
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${appUrl}/invite/accept`,
        data: { org_id: orgId, invited_role: role },
      },
    )

    if (inviteError) {
      console.error('invite-user inviteUserByEmail failed:', inviteError.message)
      const lower = inviteError.message?.toLowerCase() ?? ''
      let code = 'invite_failed'
      if (lower.includes('invalid') && lower.includes('email')) code = 'email_address_invalid'
      else if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) code = 'email_already_registered'
      else if (lower.includes('rate') || lower.includes('limit')) code = 'rate_limit'
      return new Response(JSON.stringify({ error: code, detail: inviteError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
