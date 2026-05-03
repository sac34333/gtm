/**
 * CORS helper for all Edge Functions.
 * Only allows requests from the two permitted origins.
 */

const ALLOWED_ORIGINS = [
  'https://gtmengine.qubitlyventures.com',
  'http://localhost:3000',
]

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey, x-supabase-api-version',
    'Access-Control-Max-Age': '86400',
  }
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) })
  }
  const origin = req.headers.get('Origin') ?? ''
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}
