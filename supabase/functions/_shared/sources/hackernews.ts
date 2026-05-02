import type { Signal } from './types.ts'

const HN_SEARCH_URL = 'https://hn.algolia.com/api/v1/search'

export async function fetchHackerNews(keywords: string[]): Promise<Signal[]> {
  const results: Signal[] = []

  for (const keyword of keywords) {
    try {
      const url = `${HN_SEARCH_URL}?query=${encodeURIComponent(keyword)}&tags=story&hitsPerPage=20`
      const res = await fetch(url, { headers: { 'User-Agent': 'GTMEngine/1.0' } })
      if (!res.ok) throw new Error(`HN fetch failed: ${res.status}`)

      const data = await res.json()
      for (const hit of data.hits || []) {
        if (!hit.title) continue
        results.push({
          headline: hit.title,
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          summary: hit.story_text ? hit.story_text.slice(0, 500) : undefined,
          source_name: 'Hacker News',
          source_type: 'hackernews',
          published_at: hit.created_at || undefined,
          author: hit.author || undefined,
          tags: ['hackernews', keyword],
        })
      }

      // 500ms delay between keyword queries
      await delay(500)
    } catch (err) {
      console.error(`HN error for keyword "${keyword}":`, err)
    }
  }

  return results
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
