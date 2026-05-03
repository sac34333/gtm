import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://gtmengine.qubitlyventures.com',
  'http://localhost:3000',
]

const ALLOWED_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'application/pdf',
  'image/webp',
])

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

    // 2. Get org_id from JWT claims only — never from request body
    const org_id = user.app_metadata?.org_id as string | undefined
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'no_org' }), { status: 401, headers: corsHeaders })
    }

    // 3. Validate request body size (max 1 MB)
    const contentLength = parseInt(req.headers.get('content-length') ?? '0')
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers: corsHeaders })
    }

    const body = await req.json()
    const { bucket, path: requestedPath, content_type } = body

    // 4. Validate inputs
    if (bucket !== 'brands') {
      return new Response(
        JSON.stringify({ error: 'invalid_bucket', detail: 'only the brands bucket is allowed' }),
        { status: 400, headers: corsHeaders },
      )
    }

    if (!requestedPath || typeof requestedPath !== 'string' || requestedPath.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'invalid_path' }), { status: 400, headers: corsHeaders })
    }

    // Strip any directory traversal and extract just the filename
    const filename = requestedPath.split('/').pop()
    if (!filename || filename.length === 0 || filename.length > 255) {
      return new Response(JSON.stringify({ error: 'invalid_path' }), { status: 400, headers: corsHeaders })
    }

    if (!content_type || !ALLOWED_CONTENT_TYPES.has(content_type)) {
      return new Response(
        JSON.stringify({ error: 'invalid_content_type', allowed: [...ALLOWED_CONTENT_TYPES] }),
        { status: 400, headers: corsHeaders },
      )
    }

    // 5. Build the full path — always prefixed with org_id (enforced here, not from client)
    const fullPath = `${org_id}/${filename}`

    // 6. Create signed upload URL (60s expiry)
    const { data: uploadData, error: storageError } = await serviceClient
      .storage
      .from('brands')
      .createSignedUploadUrl(fullPath)

    if (storageError || !uploadData) {
      console.error('storage signed URL error:', storageError?.message?.substring(0, 80))
      return new Response(JSON.stringify({ error: 'storage_error' }), { status: 500, headers: corsHeaders })
    }

    return new Response(
      JSON.stringify({
        signed_url: uploadData.signedUrl,
        path: fullPath,
        token: uploadData.token,
      }),
      { status: 200, headers: corsHeaders },
    )
  } catch (err) {
    console.error('get-upload-url unhandled error')
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
