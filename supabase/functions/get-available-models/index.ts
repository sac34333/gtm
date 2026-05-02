import { validateJWT } from '../_shared/auth.ts'
import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/db.ts'

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp
  const corsHeaders = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const { user } = await validateJWT(req)
    const org_id = user.app_metadata?.org_id as string | undefined
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'no_org' }), { status: 401, headers: corsHeaders })
    }

    const db = createServiceClient()

    // Fetch all active models
    const { data: models, error } = await db
      .from('available_models')
      .select(`
        model_id, provider_key, model_label, model_type, cost_tier,
        key_source, default_for_step_key, is_recommended, recommendation_order,
        context_length, max_output_tokens, output_modalities, compatible_step_keys,
        recommendation_text, requires_paid_plan, estimated_time_seconds,
        cost_per_1k_input_tokens, cost_per_1k_output_tokens, notes
      `)
      .eq('is_active', true)
      .order('recommendation_order', { ascending: true, nullsFirst: false })

    if (error) {
      return new Response(JSON.stringify({ error: 'models_fetch_failed' }), { status: 500, headers: corsHeaders })
    }

    // Check which providers the org has keys for
    const { data: orgKeys } = await db
      .from('org_provider_api_keys')
      .select('provider_key')
      .eq('org_id', org_id)

    const orgKeyProviders = new Set((orgKeys ?? []).map((k: any) => k.provider_key))

    // Get org preferences
    const { data: prefs } = await db
      .from('org_model_preferences')
      .select('step_key, model_id, provider_key')
      .eq('org_id', org_id)

    const modelsWithStatus = (models ?? []).map((m: any) => ({
      ...m,
      org_has_key: orgKeyProviders.has(m.provider_key),
    }))

    return new Response(JSON.stringify({
      models: modelsWithStatus,
      preferences: prefs ?? [],
    }), { status: 200, headers: corsHeaders })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('get-available-models error')
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
