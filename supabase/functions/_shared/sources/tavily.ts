import type { Signal } from './types.ts'

const TAVILY_URL = 'https://api.tavily.com/search'

export async function fetchTavily(query: string, apiKey: string): Promise<Signal[]> {
  const res = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'GTMEngine/1.0',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 10,
      search_depth: 'basic',
      include_answer: false,
    }),
  })

  if (!res.ok) throw new Error(`Tavily fetch failed: ${res.status}`)
  const data = await res.json()

  return (data.results || []).map((result: Record<string, unknown>) => ({
    headline: (result.title as string) || query,
    url: (result.url as string) || '',
    summary: ((result.content as string) || '').slice(0, 500),
    source_name: (result.url as string)
      ? new URL(result.url as string).hostname
      : 'Tavily',
    source_type: 'tavily',
    published_at: result.published_date as string || undefined,
    tags: ['tavily', query],
  })).filter((s: Signal) => s.headline && s.url)
}
