import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'

// Deletes one generation_jobs row + its associated storage object(s).
// Org isolation is enforced via JWT (org_id is read from app_metadata only —
// never from the request body or URL).
//
// Body: { job_id: string }
// Response: { deleted: true } | { error: string }
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()
    await requireRole(orgId, user.id, 'member', db)

    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > 1024) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const jobId = typeof body?.job_id === 'string' ? body.job_id : ''
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(jobId)) {
      return new Response(JSON.stringify({ error: 'invalid_job_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch the job (must belong to this org)
    const { data: job, error: jobErr } = await db
      .from('generation_jobs')
      .select('id, org_id, output_url, asset_type')
      .eq('id', jobId)
      .eq('org_id', orgId)
      .single()

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Best-effort storage delete. The output_url is stored as the bucket-relative
    // path (e.g. "<org_id>/abc.png") or sometimes prefixed with "assets/".
    if (job.output_url) {
      const path = String(job.output_url).replace(/^assets\//, '')
      const { error: storageErr } = await db.storage.from('assets').remove([path])
      if (storageErr) {
        // Don't fail the whole request if the storage object is already gone —
        // we still want the DB row removed. Log and continue.
        console.error('storage remove failed (continuing):', storageErr.message, { path })
      }
    }

    // Delete the row. Any child generation_jobs (refinements that point at this
    // as parent_job_id) will have their parent FK set null per migration; the
    // children themselves are NOT deleted.
    const { error: delErr } = await db
      .from('generation_jobs')
      .delete()
      .eq('id', jobId)
      .eq('org_id', orgId)

    if (delErr) {
      console.error('row delete failed:', delErr.message)
      return new Response(JSON.stringify({ error: 'delete_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('delete-asset error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
