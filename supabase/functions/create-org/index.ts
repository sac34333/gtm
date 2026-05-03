import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://gtmengine.qubitlyventures.com',
  'http://localhost:3000',
]

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? ''

  if (req.method === 'OPTIONS') {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(null, { status: 403 })
    }
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey, x-supabase-api-version',
      },
    })
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  }

  const corsHeaders = { 'Access-Control-Allow-Origin': origin, 'Content-Type': 'application/json' }

  try {
    // 1. Auth — get user from JWT
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(jwt)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // 2. Validate request body size (max 1 MB)
    const contentLength = parseInt(req.headers.get('content-length') ?? '0')
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers: corsHeaders })
    }

    const body = await req.json()
    const { name, slug } = body

    // 3. Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 120) {
      return new Response(JSON.stringify({ error: 'invalid_name' }), { status: 400, headers: corsHeaders })
    }
    if (!slug || typeof slug !== 'string') {
      return new Response(JSON.stringify({ error: 'invalid_slug' }), { status: 400, headers: corsHeaders })
    }
    if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
      return new Response(
        JSON.stringify({ error: 'invalid_slug', detail: 'slug must be 3-30 chars, lowercase a-z, 0-9, hyphens only' }),
        { status: 400, headers: corsHeaders },
      )
    }

    // 4. Idempotency — if user already has an org_members row, return 409
    const { data: existingMember } = await serviceClient
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingMember) {
      return new Response(JSON.stringify({ error: 'org_already_exists' }), { status: 409, headers: corsHeaders })
    }

    // 5. Check slug uniqueness
    const { data: slugConflict } = await serviceClient
      .from('orgs')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (slugConflict) {
      return new Response(JSON.stringify({ error: 'slug_taken' }), { status: 409, headers: corsHeaders })
    }

    // 6. Create org
    const { data: org, error: orgError } = await serviceClient
      .from('orgs')
      .insert({
        name: name.trim(),
        slug,
        plan_tier: 'starter',
        seat_limit: 2,
        image_quota: 50,
        video_quota: 5,
        image_used: 0,
        video_used: 0,
        signal_ingestion_enabled: false,
        onboarding_complete: false,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      console.error('org insert error:', orgError?.code)
      return new Response(JSON.stringify({ error: 'create_org_failed' }), { status: 500, headers: corsHeaders })
    }

    // 7. Create org_members row (owner)
    const { error: memberError } = await serviceClient
      .from('org_members')
      .insert({
        org_id: org.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
      })

    if (memberError) {
      console.error('org_members insert error:', memberError?.code)
      // Roll back org creation
      await serviceClient.from('orgs').delete().eq('id', org.id)
      return new Response(JSON.stringify({ error: 'create_org_failed' }), { status: 500, headers: corsHeaders })
    }

    // 8. Set app_metadata.org_id on the auth user
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(user.id, {
      app_metadata: { org_id: org.id },
    })

    if (updateError) {
      console.error('auth metadata update error:', updateError?.message?.substring(0, 80))
    }

    return new Response(JSON.stringify({ org_id: org.id, slug }), { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error('create-org unhandled error')
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
