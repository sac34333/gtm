import type { Signal } from './types.ts'

// Apify LinkedIn scraper actor ID
const APIFY_ACTOR_ID = 'apify~linkedin-post-search-scraper'
const APIFY_BASE = 'https://api.apify.com/v2'

export async function fetchLinkedIn(profileUrl: string, apifyToken: string): Promise<Signal[]> {
  // Start the Apify actor run
  const runRes = await fetch(
    `${APIFY_BASE}/acts/${APIFY_ACTOR_ID}/runs?token=${apifyToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: profileUrl }],
        maxPosts: 10,
      }),
    },
  )

  if (!runRes.ok) throw new Error(`Apify LinkedIn run failed: ${runRes.status}`)
  const run = await runRes.json()
  const datasetId = run?.data?.defaultDatasetId
  if (!datasetId) throw new Error('Apify: no datasetId in response')

  // Poll for completion (max 30s)
  const runId = run?.data?.id
  for (let i = 0; i < 6; i++) {
    await delay(5000)
    const statusRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${apifyToken}`,
    )
    if (statusRes.ok) {
      const statusData = await statusRes.json()
      if (statusData?.data?.status === 'SUCCEEDED') break
      if (statusData?.data?.status === 'FAILED') {
        throw new Error('Apify LinkedIn run failed')
      }
    }
  }

  // Fetch results
  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${apifyToken}&format=json`,
  )
  if (!itemsRes.ok) throw new Error(`Apify dataset fetch failed: ${itemsRes.status}`)
  const items = await itemsRes.json()

  // IMPORTANT: only normalised fields — no enrichment_data (spec section 14.3)
  return (items || []).map((item: Record<string, unknown>) => ({
    headline: ((item.text as string) || '').slice(0, 280),
    url: (item.postUrl as string) || profileUrl,
    summary: ((item.text as string) || '').slice(0, 500),
    source_name: (item.authorName as string) || 'LinkedIn',
    source_type: 'apify_linkedin',
    published_at: item.postedAt as string || undefined,
    // NO enrichment_data — raw data not retained beyond 24h per spec 14.3
    tags: ['linkedin'],
  })).filter((s: Signal) => s.headline)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
