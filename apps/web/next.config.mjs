import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Lint warnings/errors should not block Cloudflare Pages production builds.
    // Run `npm run lint` locally / in CI separately.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Generated Supabase types may lag behind migrations. Don't block deploys
    // on type errors — surface them in the IDE / CI instead.
    ignoreBuildErrors: true,
  },
  images: {
    // Cloudflare Pages does not run the default Next image optimiser at the edge.
    // Use `unoptimized` so <Image> just emits a plain <img> referencing the source URL.
    // (You can swap to `loader: 'custom'` + Cloudflare Images later if you want.)
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'fal.media' },
      { protocol: 'https', hostname: '**.fal.run' },
    ],
  },
  async headers() {
    // Baseline security headers. Applied to every route. Verified against
    // testing/security-verification.ps1 (TC-SEC-021).
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

// Only wrap with Sentry when an auth token is present (otherwise the build fails
// at source-map upload time on first deploy, before Sentry is configured).
const enableSentry = !!process.env.SENTRY_AUTH_TOKEN

export default enableSentry
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
      automaticVercelMonitors: true,
    })
  : nextConfig
