import { MetadataRoute } from 'next'

export const runtime = 'edge'

const BASE = 'https://gtmengine.qubitlyventures.com'
const NOW = new Date().toISOString()

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Homepage — highest authority (redirects to /login where the marketing pane lives)
    {
      url: `${BASE}/`,
      lastModified: NOW,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // Signup — most important conversion page for SEO
    {
      url: `${BASE}/signup`,
      lastModified: NOW,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // Login — brand search landing page
    {
      url: `${BASE}/login`,
      lastModified: NOW,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Password recovery — low SEO value but should be crawlable
    {
      url: `${BASE}/forgot-password`,
      lastModified: NOW,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
