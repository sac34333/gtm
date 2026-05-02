import { createServiceClient } from '../_shared/db.ts'
import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { encrypt } from '../_shared/encryption.ts'

const ALLOWED_KEY_NAMES = [
  'reddit_client_id',
  'reddit_secret',
  'apify_token',
  'newsapi_key',
  'twitter_bearer',
  'clearbit_key',
  'youtube_api_key',
  'tavily_api_key',
  'brave_search_api_key',
  'github_token',
]

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
    const { key_name, value } = body

    // Validate key_name
    if (!key_name || typeof key_name !== 'string' || !ALLOWED_KEY_NAMES.includes(key_name)) {
      return new Response(
        JSON.stringify({ error: 'invalid_key_name', allowed: ALLOWED_KEY_NAMES }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } },
      )
    }

    // Validate value
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'value_required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } },
      )
    }

    if (value.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'value_too_long' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } },
      )
    }

    // Check plan_tier
    const { data: org } = await db
      .from('orgs')
      .select('plan_tier')
      .eq('id', orgId)
      .single()

    if (org?.plan_tier === 'fully_subscribed') {
      return new Response(
        JSON.stringify({ error: 'key_management_disabled_on_fully_subscribed_plan' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } },
      )
    }

    // AES-256-GCM encrypt value
    const encryptedValue = await encrypt(value)

    // Upsert
    const { error: upsertError } = await db
      .from('org_api_keys')
      .upsert(
        { org_id: orgId, key_name, encrypted_value: encryptedValue, updated_at: new Date().toISOString() },
        { onConflict: 'org_id,key_name' },
      )

    if (upsertError) throw upsertError

    return new Response(
      JSON.stringify({ saved: true, key_name }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('save-data-source-key error:', err)
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    })
  }
})
