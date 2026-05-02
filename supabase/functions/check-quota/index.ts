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
    const { data: org, error } = await db
      .from('orgs')
      .select('plan_tier, image_quota, image_used, video_quota, video_used, quota_reset_at')
      .eq('id', org_id)
      .single()

    if (error || !org) {
      return new Response(JSON.stringify({ error: 'org_not_found' }), { status: 404, headers: corsHeaders })
    }

    return new Response(JSON.stringify({
      plan_tier: org.plan_tier,
      image_quota: org.image_quota,
      image_used: org.image_used,
      video_quota: org.video_quota,
      video_used: org.video_used,
      quota_reset_at: org.quota_reset_at,
    }), { status: 200, headers: corsHeaders })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('check-quota error')
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
