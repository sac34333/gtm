import { MetadataRoute } from 'next'
import { sanityClient } from '@/lib/sanity/client'

export const runtime = 'edge'

const BASE = 'https://gtmengine.qubitlyventures.com'
const NOW = new Date().toISOString()

const SLUGS_QUERY = `
  *[_type == "post" && defined(slug.current)] {
    "slug": slug.current,
    publishedAt,
    _updatedAt
  }
`

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch published blog posts from Sanity for dynamic sitemap entries
  let posts: Array<{ slug: string; publishedAt?: string; _updatedAt: string }> = []
  try {
    posts = await sanityClient.fetch(SLUGS_QUERY, {}, { next: { revalidate: 3600 } })
  } catch {
    // If Sanity is unreachable, fall back to static-only sitemap
    posts = []
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: NOW, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/signup`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/login`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/blog`, lastModified: NOW, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${BASE}/faq`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/forgot-password`, lastModified: NOW, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: post.publishedAt ?? post._updatedAt,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticRoutes, ...blogRoutes]
}
