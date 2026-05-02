---
description: "Use when writing signal source adapters (RSS, HackerNews, ProductHunt, GitHub, YouTube, Reddit, NewsAPI, Twitter, GDELT, Apify LinkedIn, Tavily, Brave Search, regional). Covers the adapter interface, deduplication, TF-IDF scoring, and error handling."
applyTo: "supabase/functions/_shared/sources/**"
---

# Signal Source Adapter Guidelines

## The 13 source adapters (spec Section 7 — build all 13)

| adapter file | source | API key required |
|---|---|---|
| `rss.ts` | Generic RSS/Atom feeds | No |
| `hackernews.ts` | HN Algolia API | No |
| `producthunt.ts` | ProductHunt GraphQL API | Yes — `PRODUCTHUNT_API_KEY` |
| `github.ts` | GitHub Trending | No (rate-limited without key) |
| `youtube.ts` | YouTube Data API v3 | Yes — `YOUTUBE_API_KEY` |
| `reddit.ts` | Reddit RSS (no auth needed) | No |
| `newsapi.ts` | NewsAPI.org | Yes — `NEWSAPI_API_KEY` |
| `twitter.ts` | Twitter/X v2 Bearer | Yes — `TWITTER_BEARER_TOKEN` |
| `gdelt.ts` | GDELT 2.0 DOC API | No |
| `apify_linkedin.ts` | Apify LinkedIn scraper | Yes — `APIFY_API_KEY` |
| `tavily.ts` | Tavily Search API | Yes — `TAVILY_API_KEY` |
| `brave_search.ts` | Brave Search API | Yes — `BRAVE_SEARCH_API_KEY` |
| `regional.ts` | Region-specific feeds (auto-selected by country_code) | Mixed |

## Adapter interface — every adapter must implement this exact shape

```typescript
// _shared/sources/{name}.ts
export interface RawSignal {
  url: string           // required — used for deduplication
  title: string         // required
  summary: string       // required — plain text, max 500 chars
  source_name: string   // e.g. 'hackernews', 'reddit', 'newsapi'
  published_at: string  // ISO 8601 UTC
  tags: string[]        // extract from content — topic/keyword tags
  image_url?: string    // optional thumbnail
}

export async function fetchSignals(
  feedConfig: FeedConfig,
  apiKey: string | null,
): Promise<RawSignal[]>
```

- Return an **empty array** `[]` on any error — never throw from an adapter.  
- Cap each adapter at **50 signals per call** — truncate if the API returns more.
- Normalize `published_at` to UTC ISO 8601 string before returning.

## Deduplication — url_hash (handled by ingest-signals, not adapters)

Each adapter returns raw signals. `ingest-signals` computes:
```typescript
const url_hash = await crypto.subtle.digest(
  'SHA-256', new TextEncoder().encode(signal.url)
).then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join(''))
```
The `signals` table has `UNIQUE(org_id, url_hash)` — insert with `ON CONFLICT DO NOTHING`.

## TF-IDF relevance scoring (handled by ingest-signals, not adapters)

Adapters do NOT score signals. The score is computed in `ingest-signals` using:
1. Brand context keywords (from `brand_contexts.brand_context_summary`)
2. TF-IDF across all signals fetched in this run
3. Result stored in `signals.relevance_score` (float 0.0–1.0)

## API key resolution per adapter

```typescript
// Resolve from org_api_keys first (decrypt), then platform env var
const key = await resolveOrgKey(supabase, org_id, source_name)
           ?? Deno.env.get(ENV_VAR_MAP[source_name])
           ?? null
// If key is null and the adapter requires one, skip it (log a warning, return [])
```

## regional.ts — country_code routing

```typescript
// Map country_code → list of feed URLs / adapter calls
const REGIONAL_FEEDS: Record<string, string[]> = {
  IN: ['https://economictimes.indiatimes.com/rssfeedstopstories.cms', ...],
  NG: ['https://businessday.ng/feed/', ...],
  AE: ['https://www.khaleejtimes.com/feed', ...],
  ZA: ['https://www.businessinsider.co.za/feed', ...],
  SG: ['https://www.businesstimes.com.sg/rss/all', ...],
  // ... add all regions from spec Section 7
}
// Fall back to global RSS feeds if country_code not in map
```

## Error handling rules

- **Never throw** from an adapter — always return `[]` with a `console.error` log
- **Log the source name** in every error: `console.error('[sources/reddit] fetch failed:', err)`
- **Timeout every fetch**: use `AbortSignal.timeout(15_000)` — long-running fetches block the cron
- **Respect 429**: on rate limit response, return `[]` silently (do not retry in same run)
- **Validate response shape** before mapping — APIs change. If expected field is missing, skip that item.

## RSS / Atom parsing

Use the built-in XML parser (Deno has `DOMParser`):
```typescript
const parser = new DOMParser()
const doc = parser.parseFromString(xmlText, 'application/xml')
const items = [...doc.querySelectorAll('item, entry')]
```
Do not import a third-party RSS parser — keep the Deno bundle small.

## Adapter registry — how ingest-signals dispatches to adapters

**RULE:** `ingest-signals` MUST use a registry object — never a switch statement. A switch must be edited every time a new source is added; a registry key can be added in one line without touching any other logic.

```typescript
// supabase/functions/ingest-signals/index.ts
import { fetchRSSFeed }        from '../_shared/sources/rss.ts'
import { fetchHackerNews }     from '../_shared/sources/hackernews.ts'
import { fetchProductHunt }    from '../_shared/sources/producthunt.ts'
import { fetchGitHub }         from '../_shared/sources/github.ts'
import { fetchYouTube }        from '../_shared/sources/youtube.ts'
import { fetchReddit }         from '../_shared/sources/reddit.ts'
import { fetchNewsAPI }        from '../_shared/sources/newsapi.ts'
import { fetchTwitter }        from '../_shared/sources/twitter.ts'
import { fetchGDELT }          from '../_shared/sources/gdelt.ts'
import { fetchLinkedIn }       from '../_shared/sources/apify_linkedin.ts'
import { fetchTavily }         from '../_shared/sources/tavily.ts'
import { fetchBraveSearch }    from '../_shared/sources/brave_search.ts'
import { fetchRegionalSources } from '../_shared/sources/regional.ts'
// To add a new source: import here + add one key below — no other changes

type SourceAdapter = (feedConfig: FeedConfig, apiKey: string | null) => Promise<RawSignal[]>

const ADAPTER_REGISTRY: Record<string, SourceAdapter> = {
  rss:            fetchRSSFeed,
  hackernews:     fetchHackerNews,
  producthunt:    fetchProductHunt,
  github:         fetchGitHub,
  youtube:        fetchYouTube,
  reddit:         fetchReddit,
  newsapi:        fetchNewsAPI,
  twitter:        fetchTwitter,
  gdelt:          fetchGDELT,
  apify_linkedin: fetchLinkedIn,
  tavily:         fetchTavily,
  brave_search:   fetchBraveSearch,
  regional_auto:  fetchRegionalSources,
}

// Dispatch loop — no edits needed here when adding new adapters
for (const feedConfig of activeFeedConfigs) {
  const adapter = ADAPTER_REGISTRY[feedConfig.source_type]
  if (!adapter) {
    console.warn(`[ingest-signals] No adapter for source_type: ${feedConfig.source_type} — skipping`)
    continue
  }
  const apiKey = await resolveOrgKey(supabase, org.id, feedConfig.source_type)
  const signals = await adapter(feedConfig, apiKey)
  // ... deduplicate, score, insert
}
```

**Adding a new source type (zero schema change):**
1. Create `_shared/sources/{name}.ts` implementing the standard `fetchSignals` interface
2. Import it in `ingest-signals/index.ts` and add one key to `ADAPTER_REGISTRY`
3. INSERT a `feed_configs` row with `source_type = '{name}'` for the target org
4. Done — no migrations, no other file changes
