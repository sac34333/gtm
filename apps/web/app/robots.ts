import { MetadataRoute } from 'next'

export const runtime = 'edge'

// Cloudflare Bot Management (configured at the CF dashboard for qubitlyventures.com)
// is the enforcement layer — it decides which crawlers are allowed or blocked at the
// network level before any request reaches this origin.
//
// robots.txt is a protocol-level hint for crawlers CF lets through. Its job is to
// define which PATHS they should index — not to duplicate CF's allow/block lists.
// Per-crawler Allow entries here are redundant: CF already owns that decision.

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/signup', '/forgot-password', '/reset-password'],
        disallow: [
          '/dashboard',
          '/campaigns',
          '/library',
          '/icp',
          '/settings',
          '/create',
          '/onboarding',
          '/api/',
          '/auth/',
        ],
      },
    ],
    sitemap: 'https://gtmengine.qubitlyventures.com/sitemap.xml',
    host: 'https://gtmengine.qubitlyventures.com',
  }
}
