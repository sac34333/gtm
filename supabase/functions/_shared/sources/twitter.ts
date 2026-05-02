import type { Signal } from './types.ts'

export async function fetchTwitter(query: string, bearerToken: string): Promise<Signal[]> {
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=created_at,author_id,text&expansions=author_id&user.fields=name,username`

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'User-Agent': 'GTMEngine/1.0',
    },
  })
  if (!res.ok) throw new Error(`Twitter fetch failed: ${res.status}`)

  const data = await res.json()
  if (data.errors) throw new Error(`Twitter API error: ${JSON.stringify(data.errors)}`)

  const tweets = data.data || []
  const users: Record<string, Record<string, string>> = {}
  for (const user of data.includes?.users || []) {
    users[user.id] = user
  }

  return tweets.map((tweet: Record<string, unknown>) => {
    const author = users[tweet.author_id as string]
    const tweetUrl = `https://twitter.com/${author?.username || 'i'}/status/${tweet.id}`
    return {
      headline: (tweet.text as string).slice(0, 280),
      url: tweetUrl,
      summary: (tweet.text as string).slice(0, 500),
      source_name: author?.name || 'Twitter',
      source_type: 'twitter',
      published_at: tweet.created_at as string || undefined,
      author: author?.username || undefined,
      tags: ['twitter'],
    }
  })
}
