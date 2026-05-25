import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface JWTPayload {
  sub: string
  email?: string
  app_metadata?: {
    org_id?: string
  }
}

export async function validateJWT(req: Request): Promise<{ user: any; jwt: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }
  const jwt = authHeader.replace('Bearer ', '')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )

  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) {
    throw new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  return { user, jwt }
}

export function extractOrgId(user: any): string {
  const orgId = user?.app_metadata?.org_id
  if (!orgId) {
    throw new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(orgId)) {
    throw new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }
  return orgId
}

// Role hierarchy: owner > admin > member > viewer
const ROLE_ORDER: Record<string, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  viewer: 0,
}

export async function requireRole(
  orgId: string,
  userId: string,
  minRole: 'owner' | 'admin' | 'member' | 'viewer',
  serviceClient: any,
): Promise<string> {
  const { data, error } = await serviceClient
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (error || !data) {
    throw new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  }

  const userRank = ROLE_ORDER[data.role] ?? 0
  const requiredRank = ROLE_ORDER[minRole] ?? 0

  if (userRank < requiredRank) {
    throw new Response(JSON.stringify({ error: 'insufficient_role' }), { status: 403 })
  }

  return data.role
}
