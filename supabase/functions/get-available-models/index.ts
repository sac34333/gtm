import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/db.ts'
import { decrypt } from '../_shared/encryption.ts'

// Module-level cache: org_id ? {data, timestamp}
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp
  const corsHeaders = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    await requireRole(orgId, user.id, 'member', db)

    // Check cache
    const cached = cache.get(orgId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cached.data), { status: 200, headers: corsHeaders })
    }

    // Fetch org plan to determine which models to expose
    const { data: org } = await db
      .from('orgs')
      .select('plan_tier, byok_mode')
      .eq('id', orgId)
      .single()
    const planTier = (org?.plan_tier ?? 'starter') as string
    const isStarter = planTier === 'starter'

    // Fetch all active models
    const { data: models, error } = await db
      .from('available_models')
      .select(`
        id, model_id, provider_key, model_label, model_type, cost_tier,
        key_source, default_for_step_key, is_recommended, recommendation_order,
        context_length, max_output_tokens, output_modalities, compatible_step_keys,
        recommendation_text, requires_paid_plan, estimated_time_seconds, release_date,
        cost_per_1k_input_tokens, cost_per_1k_output_tokens, notes, is_active,
        model_caps
      `)
      .eq('is_active', true)
      .order('recommendation_order', { ascending: true, nullsFirst: false })

    if (error) {
      return new Response(JSON.stringify({ error: 'models_fetch_failed' }), { status: 500, headers: corsHeaders })
    }

    // Fetch all active providers
    const { data: providers } = await db
      .from('model_providers')
      .select('provider_key, display_name, platform_key_available, is_active, docs_url')
      .eq('is_active', true)

    // Fetch org provider keys
    const { data: orgKeys } = await db
      .from('org_provider_api_keys')
      .select('provider_key, encrypted_key')
      .eq('org_id', orgId)

    const orgKeyMap = new Map((orgKeys ?? []).map((k: any) => [k.provider_key, k.encrypted_key]))

    // Fetch org model preferences
    const { data: prefs } = await db
      .from('org_model_preferences')
      .select('step_key, provider_key, model_id, model_label')
      .eq('org_id', orgId)

    const allModels = models ?? []

    // For OpenRouter ONLY: merge live models if org has a key
    let liveOpenRouterModels: any[] = []
    const openRouterEncryptedKey = orgKeyMap.get('openrouter')
    if (openRouterEncryptedKey) {
      try {
        const decryptedKey = await decrypt(openRouterEncryptedKey)
        const orResp = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { 'Authorization': `Bearer ${decryptedKey}` },
        })
        if (orResp.ok) {
          const orData = await orResp.json()
          const dbModelIds = new Set(
            allModels.filter((m: any) => m.provider_key === 'openrouter').map((m: any) => m.model_id),
          )
          liveOpenRouterModels = (orData.data ?? [])
            .filter((m: any) => !dbModelIds.has(m.id))
            .map((m: any) => ({
              id: null,
              model_id: m.id,
              provider_key: 'openrouter',
              model_label: m.name ?? m.id,
              model_type: 'text',
              cost_tier: 'medium',
              key_source: 'user',
              is_active: true,
              is_recommended: false,
              recommendation_order: null,
              compatible_step_keys: [],
              default_for_step_key: [],
            }))
        }
      } catch { /* silently ignore live merge failures */ }
    }

    const providersResult = (providers ?? []).map((p: any) => {
      const providerModels = allModels.filter((m: any) => m.provider_key === p.provider_key)
      const liveExtra = p.provider_key === 'openrouter' ? liveOpenRouterModels : []
      return {
        provider_key: p.provider_key,
        display_name: p.display_name,
        platform_key_available: p.platform_key_available,
        has_org_key: orgKeyMap.has(p.provider_key),
        docs_url: p.docs_url,
        models: [...providerModels, ...liveExtra],
      }
    })

    const recommended = allModels.filter((m: any) => m.is_recommended)

    // Build flat models array (used by /create page) with availability filter:
    // - Starter plan: only platform-available models (key_source in platform/user_or_platform), or models where org has its own key
    // - BYOK / Fully Subscribed: all active models, with org_has_key flag for client to display
    const flatModels = allModels
      .map((m: any) => {
        const orgHasKey = orgKeyMap.has(m.provider_key)
        const platformAvailable = m.key_source === 'platform' || m.key_source === 'user_or_platform'
        return {
          ...m,
          org_has_key: orgHasKey,
          platform_available: platformAvailable,
          available: orgHasKey || platformAvailable,
        }
      })
      .filter((m: any) => {
        if (!m.available) return false
        if (isStarter) {
          // Starter: only show models that work without BYOK (platform key only).
          // BYOK keys typically aren't configured on starter, but if they are, allow them.
          return m.platform_available || m.org_has_key
        }
        return true
      })

    const responseData = {
      providers: providersResult,
      recommended,
      preferences: prefs ?? [],
      models: flatModels,
      plan_tier: planTier,
      can_change_models: planTier === 'fully_subscribed',
      cached_at: new Date().toISOString(),
    }

    cache.set(orgId, { data: responseData, timestamp: Date.now() })

    return new Response(JSON.stringify(responseData), { status: 200, headers: corsHeaders })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('get-available-models error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
