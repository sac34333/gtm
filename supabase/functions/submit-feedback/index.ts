import { validateJWT, requireRole } from '../_shared/auth.ts'
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

    const contentLength = parseInt(req.headers.get('content-length') ?? '0')
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers: corsHeaders })
    }

    const body = await req.json()
    const { job_id, rating, thumbs, note, tags_changed, regenerated } = body

    if (!job_id || typeof job_id !== 'string') {
      return new Response(JSON.stringify({ error: 'job_id_required' }), { status: 400, headers: corsHeaders })
    }
    if (rating === undefined && thumbs === undefined) {
      return new Response(JSON.stringify({ error: 'rating_or_thumbs_required' }), { status: 400, headers: corsHeaders })
    }
    if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      return new Response(JSON.stringify({ error: 'rating_must_be_1_to_5' }), { status: 400, headers: corsHeaders })
    }
    if (thumbs !== undefined && thumbs !== 'up' && thumbs !== 'down') {
      return new Response(JSON.stringify({ error: 'thumbs_must_be_up_or_down' }), { status: 400, headers: corsHeaders })
    }

    const db = createServiceClient()
    await requireRole(org_id, user.id, 'member', db)

    // Verify the job belongs to this org
    const { data: job } = await db
      .from('generation_jobs')
      .select('id')
      .eq('id', job_id)
      .eq('org_id', org_id)
      .single()

    if (!job) {
      return new Response(JSON.stringify({ error: 'job_not_found' }), { status: 404, headers: corsHeaders })
    }

    const { data: feedback, error: insertError } = await db
      .from('generation_feedback')
      .insert({
        org_id,
        job_id,
        user_id: user.id,
        rating: rating ?? null,
        thumbs: thumbs ?? null,
        feedback_text: note ?? null,
        tags_changed: tags_changed ?? null,
        regenerated: regenerated ?? false,
      })
      .select('id')
      .single()

    if (insertError || !feedback) {
      console.error('submit-feedback insert error:', insertError?.code)
      return new Response(JSON.stringify({ error: 'save_failed' }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ saved: true, feedback_id: feedback.id }), { status: 200, headers: corsHeaders })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('submit-feedback error')
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
