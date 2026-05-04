import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'edge'

/**
 * Supabase auth callback handler.
 *
 * Used by:
 * - Email confirmation (signup)        → next=/create-org
 * - Password recovery emails           → next=/reset-password
 * - Magic link / OAuth (future)        → next=/dashboard
 *
 * @supabase/ssr defaults to the PKCE flow, which means Supabase emails contain
 * a `?code=...` query param. We must exchange that code for a session on the
 * server (cookies are http-only) before redirecting the user.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const errorDescription = searchParams.get('error_description')

  // Reject open redirects — only allow same-origin paths
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  if (errorDescription) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', errorDescription)
    return NextResponse.redirect(url)
  }

  if (!code) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', 'Missing verification code')
    return NextResponse.redirect(url)
  }

  const response = NextResponse.redirect(new URL(safeNext, origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', 'Invalid or expired link. Please try again.')
    return NextResponse.redirect(url)
  }

  return response
}
