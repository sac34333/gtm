import type { Signal } from './types.ts'

export async function fetchNewsAPI(keywords: string[], apiKey: string): Promise<Signal[]> {
  const query = keywords.slice(0, 5).join(' OR ')
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${apiKey}&pageSize=20&language=en&sortBy=publishedAt`

  const res = await fetch(url, { headers: { 'User-Agent': 'GTMEngine/1.0' } })
  if (!res.ok) throw new Error(`NewsAPI fetch failed: ${res.status}`)

  const data = await res.json()
  if (data.status !== 'ok') throw new Error(`NewsAPI error: ${data.message || data.status}`)

  return (data.articles || []).map((article: Record<string, unknown>) => ({
    headline: (article.title as string) || '',
    url: (article.url as string) || '',
    summary: ((article.description as string) || (article.content as string) || '').slice(0, 500),
    source_name: (article.source as Record<string, string>)?.name || 'NewsAPI',
    source_type: 'newsapi',
    published_at: article.publishedAt as string || undefined,
    author: article.author as string || undefined,
    tags: ['newsapi'],
  })).filter((s: Signal) => s.headline && s.url)
}
