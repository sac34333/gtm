import type { Signal } from './types.ts'

export async function fetchRSSFeed(url: string, sourceLabel?: string): Promise<Signal[]> {
  // Validate reachability
  try {
    const head = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'GTMEngine/1.0' },
    })
    if (!head.ok && head.status !== 405) throw new Error(`unreachable: ${head.status}`)
  } catch (_e) {
    // HEAD not supported on some servers — proceed with GET
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'GTMEngine/1.0 (+https://gtmengine.qubitlyventures.com)' },
  })
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${url}`)

  const xml = await res.text()

  // Simple XML parser — no external dependency required in Deno
  const items: Signal[] = []

  // Support both RSS <item> and Atom <entry>
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi
  const feedTitleMatch = xml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)
  const feedTitle = feedTitleMatch?.[1]?.trim() || sourceLabel || url

  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const chunk = match[1]

    const title = extractTag(chunk, 'title') || ''
    const link = extractLink(chunk) || ''
    if (!title || !link) continue

    const description = extractTag(chunk, 'description') || extractTag(chunk, 'summary') || ''
    const pubDate = extractTag(chunk, 'pubDate') || extractTag(chunk, 'published') || extractTag(chunk, 'updated') || ''
    const author = extractTag(chunk, 'author') || extractTag(chunk, 'dc:creator') || undefined

    items.push({
      headline: title.trim(),
      url: link.trim(),
      summary: stripHtml(description).slice(0, 500),
      source_name: feedTitle,
      source_type: 'rss',
      published_at: pubDate ? safeDate(pubDate) : undefined,
      author,
    })

    if (items.length >= 20) break
  }

  return items
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
  return re.exec(xml)?.[1]?.trim() || ''
}

function extractLink(chunk: string): string {
  // <link>...</link> or <link href="..."/>
  const hrefMatch = chunk.match(/<link[^>]+href=["']([^"']+)["']/i)
  if (hrefMatch) return hrefMatch[1]
  const textMatch = chunk.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i)
  return textMatch?.[1]?.trim() || ''
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function safeDate(str: string): string | undefined {
  try {
    return new Date(str).toISOString()
  } catch {
    return undefined
  }
}
