import { MetadataRoute } from 'next'

export const runtime = 'edge'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // All crawlers — allow public pages, block authenticated app routes
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
      // AI / LLM crawlers — explicitly invited to index public content
      // Explicit allowance signals that you WANT these systems to index your content
      // for retrieval-augmented generation (RAG) and training pipelines.
      { userAgent: 'GPTBot',          allow: ['/'] },
      { userAgent: 'ChatGPT-User',    allow: ['/'] },
      { userAgent: 'Google-Extended', allow: ['/'] },
      { userAgent: 'PerplexityBot',   allow: ['/'] },
      { userAgent: 'ClaudeBot',       allow: ['/'] },
      { userAgent: 'anthropic-ai',    allow: ['/'] },
      { userAgent: 'Applebot',        allow: ['/'] },
      { userAgent: 'cohere-ai',       allow: ['/'] },
      { userAgent: 'Bytespider',      allow: ['/'] },
      { userAgent: 'CCBot',           allow: ['/'] },
    ],
    sitemap: 'https://gtmengine.qubitlyventures.com/sitemap.xml',
    host: 'https://gtmengine.qubitlyventures.com',
  }
}
