import type { Signal } from './types.ts'

const GDELT_URL = 'https://api.gdeltproject.org/api/v2/doc/doc'

export async function fetchGDELT(keywords: string[]): Promise<Signal[]> {
  const results: Signal[] = []

  for (const keyword of keywords) {
    try {
      const url = `${GDELT_URL}?query=${encodeURIComponent(keyword)}&mode=artlist&format=json&maxrecords=20`
      const res = await fetch(url, { headers: { 'User-Agent': 'GTMEngine/1.0' } })
      if (!res.ok) throw new Error(`GDELT fetch failed: ${res.status}`)

      const data = await res.json()
      for (const article of data.articles || []) {
        if (!article.title || !article.url) continue
        results.push({
          headline: article.title,
          url: article.url,
          summary: (article.seendescription || '').slice(0, 500),
          source_name: article.domain || 'GDELT',
          source_type: 'gdelt',
          published_at: article.seendate
            ? parseGDELTDate(article.seendate)
            : undefined,
          tags: ['gdelt', keyword],
        })
      }

      // 2-second delay between GDELT calls (rate limit)
      await delay(2000)
    } catch (err) {
      console.error(`GDELT error for keyword "${keyword}":`, err)
    }
  }

  return results.slice(0, 40)
}

function parseGDELTDate(str: string): string | undefined {
  // GDELT format: "20240501T120000Z"
  try {
    const clean = str.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')
    return new Date(clean).toISOString()
  } catch {
    return undefined
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
