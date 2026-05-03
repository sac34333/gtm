import { createServiceClient } from '../_shared/db.ts'
import { decrypt } from '../_shared/encryption.ts'
import { scoreRelevance, matchesTheme } from '../_shared/relevance.ts'
import { fetchRSSFeed } from '../_shared/sources/rss.ts'
import { fetchHackerNews } from '../_shared/sources/hackernews.ts'
import { fetchProductHunt } from '../_shared/sources/producthunt.ts'
import { fetchGitHub } from '../_shared/sources/github.ts'
import { fetchYouTube } from '../_shared/sources/youtube.ts'
import { fetchReddit } from '../_shared/sources/reddit.ts'
import { fetchNewsAPI } from '../_shared/sources/newsapi.ts'
import { fetchTwitter } from '../_shared/sources/twitter.ts'
import { fetchGDELT } from '../_shared/sources/gdelt.ts'
import { fetchLinkedIn } from '../_shared/sources/apify_linkedin.ts'
import { fetchTavily } from '../_shared/sources/tavily.ts'
import { fetchBraveSearch } from '../_shared/sources/brave_search.ts'
import type { Signal } from '../_shared/sources/types.ts'

const FREQUENCY_INTERVALS: Record<string, number> = {
  daily: 1 * 24 * 60 * 60 * 1000,
  every_2_days: 2 * 24 * 60 * 60 * 1000,
  every_3_days: 3 * 24 * 60 * 60 * 1000,
  every_5_days: 5 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

Deno.serve(async (req: Request) => {
  // Cron-triggered: accept either CRON_SECRET (x-cron-secret header) or service role key (Authorization)
  const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronOk = cronSecret.length > 0 && cronSecretHeader === cronSecret
  const srOk = serviceRoleKey.length > 0 && authHeader.includes(serviceRoleKey)
  if (!cronOk && !srOk) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  const db = createServiceClient()
  let processedOrgs = 0
  let totalSignalsIngested = 0

  try {
    // 1. Query ALL orgs
    const { data: orgs, error: orgsError } = await db
      .from('orgs')
      .select('id, signal_ingestion_enabled, signal_ingestion_frequency, last_signal_ingestion_at, country_code, plan_tier')

    if (orgsError) throw orgsError

    const now = Date.now()

    for (const org of orgs || []) {
      try {
        // Skip if ingestion disabled
        if (!org.signal_ingestion_enabled) continue

        // Check frequency
        if (org.last_signal_ingestion_at) {
          const lastRun = new Date(org.last_signal_ingestion_at).getTime()
          const interval = FREQUENCY_INTERVALS[org.signal_ingestion_frequency ?? 'every_2_days'] ?? FREQUENCY_INTERVALS.every_2_days
          if (now - lastRun < interval) continue
        }

        // Fetch brand context
        const { data: brandCtx } = await db
          .from('brand_contexts')
          .select('active_themes, competitor_names')
          .eq('org_id', org.id)
          .single()

        const activeThemes: string[] = brandCtx?.active_themes ?? []
        const competitorNames: string[] = brandCtx?.competitor_names ?? []

        // Fetch active feed configs
        const { data: feedConfigs } = await db
          .from('feed_configs')
          .select('*')
          .eq('org_id', org.id)
          .eq('is_active', true)

        // Decrypt API keys (skip for fully_subscribed — use platform env vars)
        const orgKeys: Record<string, string> = {}
        if (org.plan_tier !== 'fully_subscribed') {
          const { data: apiKeys } = await db
            .from('org_api_keys')
            .select('key_name, encrypted_value')
            .eq('org_id', org.id)

          for (const row of apiKeys ?? []) {
            try {
              orgKeys[row.key_name] = await decrypt(row.encrypted_value)
            } catch {
              // Skip keys that fail to decrypt
            }
          }
        }

        // Resolve platform keys for fully_subscribed plan
        const getKey = (name: string): string | undefined => {
          if (org.plan_tier === 'fully_subscribed') {
            return Deno.env.get(name.toUpperCase()) ?? undefined
          }
          return orgKeys[name] ?? Deno.env.get(name.toUpperCase()) ?? undefined
        }

        let orgSignalsCount = 0

        for (const config of feedConfigs ?? []) {
          let rawSignals: Signal[] = []
          try {
            rawSignals = await callAdapter(config, orgKeys, getKey, activeThemes, competitorNames, db)
          } catch (err) {
            console.error(`Adapter error [${config.source_type}] org=${org.id}:`, err)
            // Increment error_count — don't abort
            await db
              .from('feed_configs')
              .update({ error_count: (config.error_count ?? 0) + 1 })
              .eq('id', config.id)
            continue
          }

          for (const signal of rawSignals) {
            if (!signal.url || !signal.headline) continue

            // Compute url_hash
            const urlHash = await sha256(signal.url)

            // Deduplication check
            const { data: existing } = await db
              .from('signals')
              .select('id')
              .eq('org_id', org.id)
              .eq('url_hash', urlHash)
              .single()

            if (existing) continue

            // Score relevance
            const relevanceScore = scoreRelevance(
              signal.headline,
              signal.summary ?? '',
              activeThemes,
              competitorNames,
            )

            // Only store if score > 0
            if (relevanceScore <= 0) continue

            // Skip articles older than 180 days at the source — avoids evergreen
            // HN threads / Wikipedia pages from years ago resurfacing as "new" signals.
            if (signal.published_at) {
              const publishedMs = new Date(signal.published_at).getTime()
              if (Number.isFinite(publishedMs)) {
                const ageDays = (Date.now() - publishedMs) / (1000 * 60 * 60 * 24)
                if (ageDays > 180) continue
              }
            }

            // Compute which themes and keywords matched (token-based, stopword-aware)
            const signalText = `${signal.headline} ${signal.summary ?? ''}`
            const matchedThemes = activeThemes.filter((t) => matchesTheme(signalText, t))
            const matchedKeywords = (config.keywords as string[] ?? []).filter((k) =>
              matchesTheme(signalText, k)
            )

            const { error: insertError } = await db.from('signals').insert({
              org_id: org.id,
              feed_config_id: config.id,
              url_hash: urlHash,
              url: signal.url,
              headline: signal.headline,
              summary: signal.summary ?? null,
              source_name: signal.source_name ?? null,
              source_type: signal.source_type,
              published_at: signal.published_at ?? null,
              relevance_score: relevanceScore,
              matched_themes: matchedThemes,
              matched_keywords: matchedKeywords,
              tags: signal.tags ?? [],
              status: 'unread',
            })

            if (!insertError) {
              orgSignalsCount++
              totalSignalsIngested++
            }
          }
        }

        // Update last_signal_ingestion_at
        await db
          .from('orgs')
          .update({ last_signal_ingestion_at: new Date().toISOString() })
          .eq('id', org.id)

        processedOrgs++
        console.log(`Org ${org.id}: ingested ${orgSignalsCount} signals`)
      } catch (orgErr) {
        console.error(`Error processing org ${org.id}:`, orgErr)
      }
    }
  } catch (err) {
    console.error('ingest-signals fatal error:', err)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 })
  }

  return new Response(
    JSON.stringify({ processed_orgs: processedOrgs, total_signals_ingested: totalSignalsIngested }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})

async function callAdapter(
  config: Record<string, unknown>,
  orgKeys: Record<string, string>,
  getKey: (name: string) => string | undefined,
  activeThemes: string[],
  competitorNames: string[],
  db: ReturnType<typeof createServiceClient>,
): Promise<Signal[]> {
  const sourceType = config.source_type as string
  const sourceUrl = config.source_url as string
  const keywords = (config.keywords as string[]) ?? []
  const allKeywords = [...activeThemes, ...competitorNames, ...keywords]

  switch (sourceType) {
    case 'rss':
      return fetchRSSFeed(sourceUrl, config.source_label as string)

    case 'hackernews':
      return fetchHackerNews(allKeywords.length ? allKeywords : ['startup', 'saas', 'tech'])

    case 'producthunt':
      return fetchProductHunt(allKeywords)

    case 'github': {
      const token = getKey('github_token')
      return fetchGitHub(sourceUrl || (config.source_label as string), token)
    }

    case 'youtube': {
      const key = getKey('youtube_api_key')
      if (!key) throw new Error('youtube_api_key not set')
      return fetchYouTube(sourceUrl, key)
    }

    case 'reddit': {
      const clientId = getKey('reddit_client_id')
      const secret = getKey('reddit_secret')
      if (!clientId || !secret) throw new Error('Reddit credentials not set')
      const sub = sourceUrl || 'technology'
      return fetchReddit(sub, allKeywords, clientId, secret)
    }

    case 'newsapi': {
      const key = getKey('newsapi_key')
      if (!key) throw new Error('newsapi_key not set')
      return fetchNewsAPI(allKeywords.length ? allKeywords : ['technology'], key)
    }

    case 'twitter': {
      const token = getKey('twitter_bearer')
      if (!token) throw new Error('twitter_bearer not set')
      const query = allKeywords.length ? allKeywords.slice(0, 3).join(' OR ') : 'startup'
      return fetchTwitter(query, token)
    }

    case 'gdelt':
      return fetchGDELT(allKeywords.length ? allKeywords : ['technology'])

    case 'apify_linkedin': {
      const token = getKey('apify_token')
      if (!token) throw new Error('apify_token not set')
      return fetchLinkedIn(sourceUrl, token)
    }

    case 'tavily': {
      const key = getKey('tavily_api_key') ?? Deno.env.get('TAVILY_API_KEY')
      if (!key) throw new Error('tavily_api_key not set')
      console.log(`[tavily] starting, key present, themes=${activeThemes.length}, competitors=${competitorNames.length}`)

      // Budget: at most 1 search per theme/competitor per 6 hours.
      // State is stored in feed_configs.config.tavily_last_called[query] = ISO timestamp.
      const COOLDOWN_MS = 6 * 60 * 60 * 1000
      const now = Date.now()
      const cfg = (config.config as Record<string, unknown>) ?? {}
      const lastCalled = (cfg.tavily_last_called as Record<string, string>) ?? {}
      const updated: Record<string, string> = { ...lastCalled }

      const queries = [...activeThemes.slice(0, 3), ...competitorNames.slice(0, 3)]
      const signals: Signal[] = []
      let calls = 0
      for (const q of queries) {
        const last = lastCalled[q] ? new Date(lastCalled[q]).getTime() : 0
        if (now - last < COOLDOWN_MS) {
          console.log(`[tavily] skip "${q}" — cooldown`)
          continue
        }
        try {
          const results = await fetchTavily(q, key)
          console.log(`[tavily] "${q}" → ${results.length} results`)
          signals.push(...results)
          updated[q] = new Date(now).toISOString()
          calls++
        } catch (err) {
          console.error(`[tavily] query failed for "${q}":`, err)
        }
      }

      if (calls > 0) {
        await db
          .from('feed_configs')
          .update({ config: { ...cfg, tavily_last_called: updated } })
          .eq('id', config.id as string)
      }

      return signals
    }

    case 'brave_search': {
      const key = getKey('brave_search_api_key') ?? Deno.env.get('BRAVE_SEARCH_API_KEY')
      if (!key) throw new Error('brave_search_api_key not set')
      const signals: Signal[] = []
      for (const q of [...activeThemes.slice(0, 3), ...competitorNames.slice(0, 3)]) {
        signals.push(...await fetchBraveSearch(q, key))
      }
      return signals
    }

    case 'regional_auto':
      // regional sources are individual rss/hackernews entries; this type is never called directly
      return []

    default:
      throw new Error(`Unknown source_type: ${sourceType}`)
  }
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
