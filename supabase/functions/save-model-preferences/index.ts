import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { SaveModelPreferencesBodySchema } from '../_shared/schemas.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    await requireRole(orgId, user.id, 'admin', db)

    // Plan gate: only fully_subscribed plan can change model preferences
    const { data: org } = await db
      .from('orgs')
      .select('plan_tier')
      .eq('id', orgId)
      .single()

    if (org?.plan_tier !== 'fully_subscribed') {
      return new Response(
        JSON.stringify({ error: 'upgrade_required', message: 'Model selection is available on the Fully Subscribed plan only.' }),
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
    const parseResult = SaveModelPreferencesBodySchema.safeParse(rawBody)
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'validation_failed', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { preferences } = parseResult.data
    const saved: string[] = []
    const errors: Array<{ step_key: string; reason: string }> = []

    for (const pref of preferences) {
      // Validate (provider_key, model_id) exists in available_models with is_active=true
      const { data: model } = await db
        .from('available_models')
        .select('compatible_step_keys')
        .eq('provider_key', pref.provider_key)
        .eq('model_id', pref.model_id)
        .eq('is_active', true)
        .single()

      if (!model) {
        errors.push({ step_key: pref.step_key, reason: 'model_not_found_or_inactive' })
        continue
      }

      // Validate step_key is in compatible_step_keys
      if (model.compatible_step_keys && model.compatible_step_keys.length > 0) {
        if (!model.compatible_step_keys.includes(pref.step_key)) {
          errors.push({ step_key: pref.step_key, reason: 'step_key_not_compatible' })
          continue
        }
      }

      // Upsert preference
      const { error: upsertError } = await db
        .from('org_model_preferences')
        .upsert(
          {
            org_id: orgId,
            step_key: pref.step_key,
            provider_key: pref.provider_key,
            model_id: pref.model_id,
            model_label: pref.model_label,
            updated_by: user.id,
          },
          { onConflict: 'org_id,step_key' },
        )

      if (upsertError) {
        errors.push({ step_key: pref.step_key, reason: 'save_failed' })
      } else {
        saved.push(pref.step_key)
      }
    }

    return new Response(
      JSON.stringify({ saved, errors }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('save-model-preferences error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
