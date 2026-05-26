import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: corsHeaders })
  }

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()
    await requireRole(orgId, user.id, 'member', db)

    const { error } = await db.from('org_linkedin_connections').delete().eq('org_id', orgId)
    if (error) {
      console.error('linkedin delete error:', error.message)
      return new Response(JSON.stringify({ error: 'delete_failed' }), { status: 500, headers: corsHeaders })
    }
    return new Response(JSON.stringify({ disconnected: true }), { status: 200, headers: corsHeaders })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('delete-linkedin-connection error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
