import type { Signal } from './types.ts'

export async function fetchYouTube(channelId: string, apiKey: string): Promise<Signal[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?channelId=${encodeURIComponent(channelId)}&key=${apiKey}&type=video&order=date&maxResults=10&part=snippet`

  const res = await fetch(url, { headers: { 'User-Agent': 'GTMEngine/1.0' } })
  if (!res.ok) throw new Error(`YouTube fetch failed: ${res.status}`)

  const data = await res.json()
  if (data.error) throw new Error(`YouTube API error: ${data.error.message}`)

  return (data.items || []).map((item: Record<string, unknown>) => {
    const snippet = (item.snippet || {}) as Record<string, unknown>
    const videoId = (item.id as Record<string, string>)?.videoId
    return {
      headline: (snippet.title as string) || '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      summary: ((snippet.description as string) || '').slice(0, 500),
      source_name: (snippet.channelTitle as string) || `YouTube/${channelId}`,
      source_type: 'youtube',
      published_at: snippet.publishedAt as string || undefined,
      tags: ['youtube'],
    }
  }).filter((s: Signal) => s.headline && s.url)
}
