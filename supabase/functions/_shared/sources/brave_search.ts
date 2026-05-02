import type { Signal } from './types.ts'

const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search'

export async function fetchBraveSearch(query: string, apiKey: string): Promise<Signal[]> {
  const url = `${BRAVE_URL}?q=${encodeURIComponent(query)}&count=20`

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey,
      'User-Agent': 'GTMEngine/1.0',
    },
  })

  if (!res.ok) throw new Error(`Brave Search fetch failed: ${res.status}`)
  const data = await res.json()

  const results = data?.web?.results || []

  return results.map((result: Record<string, unknown>) => ({
    headline: (result.title as string) || query,
    url: (result.url as string) || '',
    summary: ((result.description as string) || '').slice(0, 500),
    source_name: (result.url as string)
      ? new URL(result.url as string).hostname
      : 'Brave Search',
    source_type: 'brave_search',
    published_at: (result.page_fetched as string) || undefined,
    tags: ['brave_search', query],
  })).filter((s: Signal) => s.headline && s.url)
}
