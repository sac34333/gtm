import type { Signal } from './types.ts'

export async function fetchReddit(
  subreddit: string,
  keywords: string[],
  clientId: string,
  clientSecret: string,
): Promise<Signal[]> {
  // Authenticate via Reddit OAuth client_credentials
  const credentials = btoa(`${clientId}:${clientSecret}`)
  const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'GTMEngine/1.0',
    },
    body: 'grant_type=client_credentials',
  })

  if (!tokenRes.ok) throw new Error(`Reddit auth failed: ${tokenRes.status}`)
  const tokenData = await tokenRes.json()
  const accessToken = tokenData.access_token
  if (!accessToken) throw new Error('Reddit: no access token in response')

  const res = await fetch(
    `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?limit=50`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'GTMEngine/1.0',
      },
    },
  )
  if (!res.ok) throw new Error(`Reddit fetch failed: ${res.status}`)

  const data = await res.json()
  const posts = data?.data?.children || []
  const lowerKeywords = keywords.map((k) => k.toLowerCase())

  return posts
    .filter(({ data: post }: { data: Record<string, unknown> }) => {
      if (!post.title || !post.url) return false
      if (!lowerKeywords.length) return true
      const text = `${post.title} ${post.selftext || ''}`.toLowerCase()
      return lowerKeywords.some((kw) => text.includes(kw))
    })
    .map(({ data: post }: { data: Record<string, unknown> }) => ({
      headline: post.title as string,
      url: `https://reddit.com${post.permalink}`,
      summary: ((post.selftext as string) || '').slice(0, 500),
      source_name: `Reddit / r/${subreddit}`,
      source_type: 'reddit',
      published_at: post.created_utc
        ? new Date((post.created_utc as number) * 1000).toISOString()
        : undefined,
      author: post.author as string || undefined,
      tags: ['reddit', subreddit],
    }))
    .slice(0, 20)
}
