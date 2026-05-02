import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { RemoveMemberBodySchema } from '../_shared/schemas.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    const callerRole = await requireRole(orgId, user.id, 'admin', db)

    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawBody = await req.json()
    const parseResult = RemoveMemberBodySchema.safeParse(rawBody)
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'validation_failed', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { user_id: targetUserId, action, new_role } = parseResult.data

    // Cannot self-remove
    if (targetUserId === user.id) {
      return new Response(JSON.stringify({ error: 'cannot_modify_self' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch target's role
    const { data: targetMember } = await db
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', targetUserId)
      .single()

    if (!targetMember) {
      return new Response(JSON.stringify({ error: 'member_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin cannot modify owner
    if (targetMember.role === 'owner' && callerRole === 'admin') {
      return new Response(JSON.stringify({ error: 'cannot_modify_owner' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'remove') {
      // Validate at least 1 owner remains if removing an owner
      if (targetMember.role === 'owner') {
        const { count: ownerCount } = await db
          .from('org_members')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('role', 'owner')

        if (!ownerCount || ownerCount <= 1) {
          return new Response(JSON.stringify({ error: 'cannot_remove_last_owner' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      await db
        .from('org_members')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', targetUserId)
    } else if (action === 'change_role') {
      // Only owner can change roles
      if (callerRole !== 'owner') {
        return new Response(JSON.stringify({ error: 'insufficient_role' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!new_role) {
        return new Response(JSON.stringify({ error: 'new_role_required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await db
        .from('org_members')
        .update({ role: new_role })
        .eq('org_id', orgId)
        .eq('user_id', targetUserId)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('remove-member error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
