import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { decrypt } from '../_shared/encryption.ts'

const LI_BASE = 'https://api.linkedin.com'
const LI_VERSION = '202501'

function liHeaders(token: string, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': LI_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra,
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: corsHeaders })
  }

  // Body size guard (1 MB)
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > 1_048_576) {
    return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers: corsHeaders })
  }

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    // Parse + validate body
    let body: { org_urn: string; text: string; job_id?: string }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: corsHeaders })
    }

    const { org_urn, text, job_id } = body
    if (!org_urn || typeof org_urn !== 'string' || !org_urn.startsWith('urn:li:organization:')) {
      return new Response(JSON.stringify({ error: 'invalid_org_urn' }), { status: 400, headers: corsHeaders })
    }
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'text_required' }), { status: 400, headers: corsHeaders })
    }
    if (text.length > 3000) {
      return new Response(JSON.stringify({ error: 'text_too_long' }), { status: 400, headers: corsHeaders })
    }

    // Fetch LinkedIn token for this org
    const { data: conn } = await db
      .from('org_linkedin_connections')
      .select('encrypted_access_token')
      .eq('org_id', orgId)
      .single()

    if (!conn) {
      return new Response(JSON.stringify({ error: 'not_connected' }), { status: 404, headers: corsHeaders })
    }

    let token: string
    try {
      token = await decrypt(conn.encrypted_access_token)
    } catch {
      return new Response(JSON.stringify({ error: 'token_decrypt_failed' }), { status: 500, headers: corsHeaders })
    }

    const hdrs = liHeaders(token)

    // If a job_id is provided, upload the asset image to LinkedIn first
    let imageUrn: string | null = null
    if (job_id && typeof job_id === 'string') {
      // Fetch the job to get storage path
      const { data: job } = await db
        .from('generation_jobs')
        .select('output_url, asset_type, status')
        .eq('id', job_id)
        .eq('org_id', orgId) // security: must belong to same org
        .single()

      if (!job || job.status !== 'completed' || !job.output_url) {
        return new Response(JSON.stringify({ error: 'asset_not_ready' }), { status: 400, headers: corsHeaders })
      }

      if (job.asset_type !== 'image') {
        return new Response(JSON.stringify({ error: 'only_images_supported' }), { status: 400, headers: corsHeaders })
      }

      // Generate a short-lived signed URL for the asset
      const storagePath = job.output_url.replace(/^assets\//, '')
      const { data: signedData, error: signedErr } = await db
        .storage.from('assets').createSignedUrl(storagePath, 300)

      if (signedErr || !signedData?.signedUrl) {
        return new Response(JSON.stringify({ error: 'storage_sign_failed' }), { status: 500, headers: corsHeaders })
      }

      // Fetch the image binary
      const imgRes = await fetch(signedData.signedUrl)
      if (!imgRes.ok) {
        return new Response(JSON.stringify({ error: 'asset_fetch_failed' }), { status: 500, headers: corsHeaders })
      }
      const imgBlob = await imgRes.blob()
      const contentType = imgRes.headers.get('content-type') ?? 'image/png'

      // Step 1: Initialize LinkedIn image upload
      const initRes = await fetch(`${LI_BASE}/rest/images?action=initializeUpload`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ initializeUploadRequest: { owner: org_urn } }),
      })
      if (!initRes.ok) {
        const initBody = await initRes.text()
        console.error(`LinkedIn image init failed: ${initRes.status} ${initBody.slice(0, 300)}`)
        return new Response(JSON.stringify({ error: 'linkedin_upload_init_failed' }), { status: 502, headers: corsHeaders })
      }
      const initJson = await initRes.json()
      const uploadUrl: string = initJson?.value?.uploadUrl
      imageUrn = initJson?.value?.image
      if (!uploadUrl || !imageUrn) {
        return new Response(JSON.stringify({ error: 'linkedin_upload_init_bad_response' }), { status: 502, headers: corsHeaders })
      }

      // Step 2: Upload the binary to LinkedIn
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: imgBlob,
      })
      if (!uploadRes.ok) {
        console.error(`LinkedIn image upload failed: ${uploadRes.status}`)
        return new Response(JSON.stringify({ error: 'linkedin_upload_failed' }), { status: 502, headers: corsHeaders })
      }
    }

    // Build the post payload
    const postPayload: Record<string, unknown> = {
      author: org_urn,
      commentary: text.trim(),
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }

    if (imageUrn) {
      postPayload.content = {
        media: {
          id: imageUrn,
        },
      }
    }

    // Step 3: Create the post
    const postRes = await fetch(`${LI_BASE}/rest/posts`, {
      method: 'POST',
      headers: { ...hdrs, 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload),
    })

    if (!postRes.ok) {
      const postBody = await postRes.text()
      console.error(`LinkedIn post failed: ${postRes.status} ${postBody.slice(0, 500)}`)
      return new Response(JSON.stringify({ error: 'linkedin_post_failed', detail: postRes.status }), { status: 502, headers: corsHeaders })
    }

    const postId = postRes.headers.get('x-restli-id') ?? ''
    const postUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}`

    return new Response(
      JSON.stringify({ success: true, post_id: postId, post_url: postUrl }),
      { status: 200, headers: corsHeaders },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('post-to-linkedin error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
