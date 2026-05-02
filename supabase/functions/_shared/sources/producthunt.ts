import type { Signal } from './types.ts'

const PH_GRAPHQL = 'https://api.producthunt.com/v2/api/graphql'

const POSTS_QUERY = `
  query Posts($first: Int!) {
    posts(first: $first, order: NEWEST) {
      edges {
        node {
          id
          name
          tagline
          description
          url
          votesCount
          createdAt
          topics {
            edges {
              node { name }
            }
          }
        }
      }
    }
  }
`

export async function fetchProductHunt(keywords: string[]): Promise<Signal[]> {
  try {
    const res = await fetch(PH_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Public access — no auth token required for basic queries
      },
      body: JSON.stringify({ query: POSTS_QUERY, variables: { first: 40 } }),
    })

    if (!res.ok) throw new Error(`ProductHunt fetch failed: ${res.status}`)
    const data = await res.json()

    const posts = data?.data?.posts?.edges || []
    const lowerKeywords = keywords.map((k) => k.toLowerCase())

    return posts
      .filter(({ node }: { node: Record<string, unknown> }) => {
        if (!lowerKeywords.length) return true
        const text = `${node.name} ${node.tagline} ${node.description || ''}`.toLowerCase()
        return lowerKeywords.some((kw) => text.includes(kw))
      })
      .map(({ node }: { node: Record<string, unknown> }) => ({
        headline: `${node.name}: ${node.tagline}`,
        url: node.url as string,
        summary: (node.description as string || '').slice(0, 500),
        source_name: 'Product Hunt',
        source_type: 'producthunt',
        published_at: node.createdAt as string || undefined,
        tags: [
          'producthunt',
          ...((node.topics as { edges: { node: { name: string } }[] })?.edges || []).map(
            (e: { node: { name: string } }) => e.node.name.toLowerCase(),
          ),
        ],
      }))
      .slice(0, 20)
  } catch (err) {
    throw new Error(`ProductHunt error: ${err}`)
  }
}
