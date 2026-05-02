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
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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

    // 2. Look up pending org_members row for this user
    const { data: pendingMember, error: memberError } = await serviceClient
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (memberError) {
      console.error('org_members lookup error:', memberError?.code)
      return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
    }

    if (!pendingMember) {
      return new Response(JSON.stringify({ error: 'no_pending_invite' }), { status: 404, headers: corsHeaders })
    }

    // 3. Activate the membership
    const { error: activateError } = await serviceClient
      .from('org_members')
      .update({ status: 'active' })
      .eq('user_id', user.id)
      .eq('org_id', pendingMember.org_id)
      .eq('status', 'pending')

    if (activateError) {
      console.error('activate member error:', activateError?.code)
      return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
    }

    // 4. Set app_metadata.org_id and role on the auth user
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(user.id, {
      app_metadata: { org_id: pendingMember.org_id, role: pendingMember.role },
    })

    if (updateError) {
      console.error('auth metadata update error:', updateError?.message?.substring(0, 80))
    }

    // 5. Check if org onboarding is complete
    const { data: org } = await serviceClient
      .from('orgs')
      .select('onboarding_complete')
      .eq('id', pendingMember.org_id)
      .single()

    return new Response(
      JSON.stringify({
        success: true,
        org_id: pendingMember.org_id,
        onboarding_complete: org?.onboarding_complete ?? false,
      }),
      { status: 200, headers: corsHeaders },
    )
  } catch (err) {
    console.error('accept-invite unhandled error')
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
