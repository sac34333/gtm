import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Baseline security headers applied to every response.
// Defined here (not next.config.mjs) because Cloudflare Pages does not honor
// next.config `headers()` for SSR/edge routes — only middleware reliably sets them.
// Verified against testing/security-verification.ps1 (TC-SEC-021).
const SECURITY_HEADERS: Array<[string, string]> = [
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
]

function applySecurityHeaders(res: NextResponse): NextResponse {
  for (const [k, v] of SECURITY_HEADERS) res.headers.set(k, v)
  return res
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Root path — redirect to login (or dashboard if logged in)
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = user ? '/dashboard' : '/login'
    return applySecurityHeaders(NextResponse.redirect(url))
  }

  // Public routes — no auth required
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/invite/accept',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
    '/blog',
    '/faq',
    '/contact',
    '/privacy',
    '/terms',
  ]
  if (publicRoutes.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return applySecurityHeaders(supabaseResponse)
  }

  // Unauthenticated — redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return applySecurityHeaders(NextResponse.redirect(url))
  }

  const orgId = user.app_metadata?.org_id

  // No org yet — only /create-org is allowed
  if (!orgId && pathname !== '/create-org') {
    const url = request.nextUrl.clone()
    url.pathname = '/create-org'
    return applySecurityHeaders(NextResponse.redirect(url))
  }

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
