import type { Prospect } from './types.ts'

export async function scrapePublicProfile(url: string): Promise<Partial<Prospect>> {
  let html = ''

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GTMEngine/1.0)',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) return {}
    html = await res.text()
  } catch {
    return {}
  }

  // Extract meta description
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
  const metaDesc = metaMatch?.[1]?.trim() ?? null

  // Extract visible text from first 2000 chars of body (strip tags)
  const bodyStart = html.indexOf('<body')
  const bodySlice = bodyStart >= 0 ? html.slice(bodyStart, bodyStart + 4000) : html.slice(0, 4000)
  const plainText = bodySlice
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)

  const company_description = metaDesc ?? (plainText.length > 50 ? plainText : null)

  return {
    company_description: company_description ?? null,
    enrichment_source: 'web_scrape',
  }
}
