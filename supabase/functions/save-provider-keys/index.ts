import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { encrypt } from '../_shared/encryption.ts'
import { SaveProviderKeyBodySchema } from '../_shared/schemas.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    await requireRole(orgId, user.id, 'admin', db)

    // Check plan_tier — fully_subscribed cannot manage API keys
    const { data: org } = await db
      .from('orgs')
      .select('plan_tier')
      .eq('id', orgId)
      .single()

    if (org?.plan_tier === 'fully_subscribed') {
      return new Response(
        JSON.stringify({ error: 'api_key_management_disabled_on_fully_subscribed_plan' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawBody = await req.json()
    const parseResult = SaveProviderKeyBodySchema.safeParse(rawBody)
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'validation_failed', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { provider_key, api_key, key_label } = parseResult.data

    // Validate provider exists and is active
    const { data: provider } = await db
      .from('model_providers')
      .select('provider_key')
      .eq('provider_key', provider_key)
      .eq('is_active', true)
      .single()

    if (!provider) {
      return new Response(
        JSON.stringify({ error: 'provider_not_found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Encrypt the API key
    const encryptedKey = await encrypt(api_key)

    // Upsert
    const { error: upsertError } = await db
      .from('org_provider_api_keys')
      .upsert(
        {
          org_id: orgId,
          provider_key,
          encrypted_key: encryptedKey,
          key_label: key_label ?? null,
        },
        { onConflict: 'org_id,provider_key' },
      )

    if (upsertError) {
      console.error('save-provider-keys upsert failed:', upsertError.message)
      return new Response(JSON.stringify({ error: 'save_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ saved: true, provider_key }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('save-provider-keys error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
