import type { Signal } from './types.ts'

export async function fetchGitHub(orgName: string, token?: string): Promise<Signal[]> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GTMEngine/1.0',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const results: Signal[] = []

  try {
    // Fetch org events
    const eventsRes = await fetch(
      `https://api.github.com/orgs/${encodeURIComponent(orgName)}/events?per_page=20`,
      { headers },
    )
    if (eventsRes.ok) {
      const events = await eventsRes.json()
      for (const event of events || []) {
        const repoName = event.repo?.name || orgName
        const eventType = event.type || 'Event'
        const headline = `${repoName}: ${eventType.replace('Event', '')}`
        results.push({
          headline,
          url: `https://github.com/${repoName}`,
          summary: JSON.stringify(event.payload || {}).slice(0, 500),
          source_name: `GitHub / ${orgName}`,
          source_type: 'github',
          published_at: event.created_at || undefined,
        })
      }
    }

    // Fetch org repos
    const reposRes = await fetch(
      `https://api.github.com/search/repositories?q=org:${encodeURIComponent(orgName)}&sort=updated&per_page=10`,
      { headers },
    )
    if (reposRes.ok) {
      const reposData = await reposRes.json()
      for (const repo of reposData.items || []) {
        results.push({
          headline: `${repo.full_name}: ${repo.description || 'New activity'}`,
          url: repo.html_url,
          summary: repo.description?.slice(0, 500) || undefined,
          source_name: `GitHub / ${orgName}`,
          source_type: 'github',
          published_at: repo.updated_at || undefined,
          tags: repo.topics || [],
        })
      }
    }
  } catch (err) {
    throw new Error(`GitHub error for ${orgName}: ${err}`)
  }

  return results.slice(0, 20)
}
