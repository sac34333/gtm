---
description: "Week 2 — Signal ingestion and trend dashboard: ingest-signals, 13 source adapters, update-org-settings, save-data-source-key, delete-data-source-key, /settings ingestion UI, /dashboard."
agent: agent
tools: [supabase]
---

# Week 2 — Signal Ingestion and Trend Dashboard

Read the master spec at [gtm.md](../../gtm.md) Sections 5, 9, 11.2, 11.3. Week 1 must be complete and its end-of-week test must pass before starting this week.

## STOP CHECK
Verify Week 1 is done: call `list_migrations` — must show 0001 through 0006. If not, run `/week1` first.

---

## PART 1 — Source Adapters (_shared/sources/)

Create all source adapter files. Each exports a typed function that returns `Signal[]`. Signal schema maps to the `signals` table. Errors must be caught and re-thrown as typed errors (never abort the whole ingest run from a single source failure).

### _shared/sources/rss.ts
`fetchRSSFeed(url: string): Promise<Signal[]>` — parse RSS/Atom XML. Use `npm:rss-parser` or a Deno-compatible XML parser (`npm:fast-xml-parser`). Map each entry to Signal: `headline` = title, `url` = link, `summary` = description (first 500 chars), `published_at` = pubDate, `source_name` from feed title. Validate URL is reachable with HTTP HEAD before parsing.

### _shared/sources/hackernews.ts
`fetchHackerNews(keywords: string[]): Promise<Signal[]>` — GET `https://hn.algolia.com/api/v1/search?query={keyword}&tags=story&hitsPerPage=20`. Free, no auth. Map `hits` array to Signal. Run one query per keyword in sequence with 500ms delay.

### _shared/sources/producthunt.ts
`fetchProductHunt(keywords: string[]): Promise<Signal[]>` — POST to `https://api.producthunt.com/v2/api/graphql` with public access. Query for posts matching keywords. Map to Signal.

### _shared/sources/github.ts
`fetchGitHub(orgName: string, token?: string): Promise<Signal[]>` — GET `https://api.github.com/orgs/{orgName}/events` and `https://api.github.com/search/repositories?q={orgName}`. Headers: `Authorization: Bearer {token}` if token provided (5000 req/hr), else unauthenticated (60 req/hr). Map repo activity to Signal.

### _shared/sources/youtube.ts
`fetchYouTube(channelId: string, apiKey: string): Promise<Signal[]>` — GET `https://www.googleapis.com/youtube/v3/search?channelId={id}&key={key}&type=video&order=date&maxResults=10`. Map video metadata to Signal.

### _shared/sources/reddit.ts
`fetchReddit(subreddit: string, keywords: string[], clientId: string, clientSecret: string): Promise<Signal[]>` — authenticate via Reddit OAuth (`https://www.reddit.com/api/v1/access_token` with Basic auth). GET `/r/{subreddit}/hot.json`. Filter posts containing any keyword. Map to Signal.

### _shared/sources/newsapi.ts
`fetchNewsAPI(keywords: string[], apiKey: string): Promise<Signal[]>` — GET `https://newsapi.org/v2/everything?q={keywords.join(' OR ')}&apiKey={key}&pageSize=20&language=en`. Map articles to Signal.

### _shared/sources/twitter.ts
`fetchTwitter(query: string, bearerToken: string): Promise<Signal[]>` — GET `https://api.twitter.com/2/tweets/search/recent?query={encoded_query}&max_results=10` with `Authorization: Bearer {bearerToken}`. Map tweets to Signal.

### _shared/sources/gdelt.ts
`fetchGDELT(keywords: string[]): Promise<Signal[]>` — GET `https://api.gdeltproject.org/api/v2/doc/doc?query={keyword}&mode=artlist&format=json`. Run one query per keyword. Add 2-second delay between GDELT calls (rate limit). Strong coverage for Africa, ME, South Asia, LATAM. Map articles to Signal.

### _shared/sources/apify_linkedin.ts
`fetchLinkedIn(profileUrl: string, apifyToken: string): Promise<Signal[]>` — call Apify LinkedIn scraper actor with `apifyToken`. IMPORTANT: 24h TTL enforcement — this source's signals are deleted by the cleanup-apify-signals cron after 24h (unless status='selected'). Do NOT populate `enrichment_data` for apify_linkedin signals — store only normalised headline/url/summary (spec Section 14.3).

### _shared/sources/tavily.ts
`fetchTavily(query: string, apiKey: string): Promise<Signal[]>` — POST `https://api.tavily.com/search` with `{api_key: key, query, max_results: 10}`. Returns ranked results. Map to Signal. Run one query per active_theme and per competitor_name.

### _shared/sources/brave_search.ts
`fetchBraveSearch(query: string, apiKey: string): Promise<Signal[]>` — GET `https://api.search.brave.com/res/v1/web/search?q={query}&count=20` with header `X-Subscription-Token: {apiKey}`. Returns up to 20 results. Map to Signal. Run one query per active_theme and per competitor_name.

### _shared/sources/regional.ts
`getRegionalSources(countryCode: string): FeedConfig[]` — returns pre-configured feed_config objects for auto-activation based on country_code. Regional source map from spec Section 9.3:
- IN: Economic Times, YourStory, Inc42, Moneycontrol, NASSCOM, BSE/NSE filings, Entrackr, Tracxn
- GB/EU: EU Startups, Sifted, Tech.eu, Crunchbase EU, Euronews Business, EIB
- AU/NZ: StartupSmart, SmartCompany, AFR Tech, AIIA, CRN Australia
- NG/ZA/KE/GH/EG: TechCabal, Disrupt Africa, Ventureburn, WeeTracker, PerSol
- AE/SA/IL: Wamda, ArabNet, MENA Bytes, Step Feed
- SG/MY/ID/PH/VN/TH: e27, KrASIA, Deal Street Asia, Tech In Asia
- US/CA/LATAM: TechCrunch, VentureBeat, Axios Pro, SEC EDGAR filings

---

## PART 2 — ingest-signals Edge Function

Create `supabase/functions/ingest-signals/index.ts`. This is a CRON-TRIGGERED function — it receives the service role key in the Authorization header, NOT a user JWT. DO NOT apply `requireRole` or JWT user extraction. Verify caller is service role by checking the header.

### Ingestion algorithm (spec Section 9.1):
1. Query ALL orgs using service role client: `SELECT id, signal_ingestion_enabled, signal_ingestion_frequency, last_signal_ingestion_at, country_code FROM orgs`
2. For each org:
   a. If `signal_ingestion_enabled = false` → SKIP (no adapters called, no quota used)
   b. Calculate if due: compare `now()` vs `last_signal_ingestion_at + interval(signal_ingestion_frequency)`. If not yet due → SKIP
   c. If due: fetch all `feed_configs WHERE org_id = org.id AND is_active = true`
   d. Fetch `brand_contexts.active_themes` and `brand_contexts.competitor_names` for the org
   e. Fetch org's decrypted API keys from `org_api_keys` (decrypt using `_shared/encryption.ts`)
   f. For each feed_config: call the appropriate source adapter. If adapter throws → catch, increment `feed_configs.error_count`, continue to next source (NEVER abort the whole run)
   g. For each Signal returned:
      - Compute `url_hash = SHA-256(signal.url)` using Web Crypto API
      - Check deduplication: `SELECT 1 FROM signals WHERE org_id = $org_id AND url_hash = $hash` — skip if exists
      - Score relevance: call `_shared/relevance.ts scoreRelevance(headline, summary, active_themes, competitor_names)` → 0.0–1.0
      - Only store if score > 0 (must match at least one theme/keyword)
      - INSERT into signals with `INSERT ... ON CONFLICT (org_id, url_hash) DO NOTHING`
   h. Set `orgs.last_signal_ingestion_at = now()`
3. Return `{processed_orgs: N, total_signals_ingested: M}`

### Frequency intervals:
- 'daily' → 1 day
- 'every_2_days' → 2 days
- 'every_3_days' → 3 days
- 'every_5_days' → 5 days
- 'monthly' → 30 days

### Key resolution for data sources:
- For `fully_subscribed` plan orgs: NEVER look up org_api_keys — use platform env vars: `TAVILY_API_KEY`, `BRAVE_SEARCH_API_KEY`. If env var not set → silently skip that source.
- For other plans: look up org_api_keys (decrypt), if not found → skip that source silently.

---

## PART 3 — Settings Edge Functions

### update-org-settings
POST — admin/owner only. Validates JWT + requireRole(user, 'admin').
- Accepts `{signal_ingestion_enabled?: boolean, signal_ingestion_frequency?: string}`
- Validate frequency: must be one of 'daily' | 'every_2_days' | 'every_3_days' | 'every_5_days' | 'monthly' → HTTP 400 if invalid
- UPDATE orgs table with provided fields
- If `signal_ingestion_enabled` is set to `true` AND `orgs.last_signal_ingestion_at IS NULL`: immediately trigger ingest-signals via HTTP POST (bypasses the frequency check so new users see signals right away)
- Returns `{updated: true, triggered_immediate_ingest: boolean}`

### save-data-source-key
POST — admin/owner only. Returns HTTP 403 if `plan_tier = 'fully_subscribed'`.
- Accepts `{key_name: string, value: string}`
- Validate `key_name` is one of: `reddit_client_id | reddit_secret | apify_token | newsapi_key | twitter_bearer | clearbit_key | youtube_api_key | tavily_api_key | brave_search_api_key | github_token`
- AES-256-GCM encrypt `value` using `ENCRYPTION_KEY` env var
- UPSERT into `org_api_keys`
- Returns `{saved: true, key_name}` — raw value NEVER returned

### delete-data-source-key
DELETE — admin/owner only. Returns HTTP 403 if `plan_tier = 'fully_subscribed'`.
- Accepts `{key_name: string}`
- Delete `org_api_keys` row for `org_id + key_name` using SERVICE role client
- Set `is_active = false` on any `feed_configs WHERE api_key_ref = key_name AND org_id = $org_id`
- Returns `{deleted: true, key_name}`

Deploy all 3 Edge Functions via `deploy_edge_function`. Verify with `get_logs`.

---

## PART 4 — /settings Page (Ingestion Section)

Create `apps/web/app/(dashboard)/settings/page.tsx`.

The page has multiple sections. For Week 2, focus on the **Signal Ingestion** section (spec Section 11.2):

### Ingestion toggle (prominent on/off)
- Labelled 'Automatically fetch signals'
- When OFF: banner 'Signal ingestion is paused. Turn it on to start receiving trend signals.'
- When turned ON for the first time (last_signal_ingestion_at is null): triggers immediate ingest (handled by update-org-settings Edge Function)
- Uses Supabase client PATCH via `update-org-settings` Edge Function
- shadcn `<Switch>` component

### Frequency selector (visible only when toggle is ON)
- Radio group or segmented control: Every day | Every 2 days | Every 3 days | Every 5 days | Every month
- Auto-save on change (no separate Save button for frequency)
- Below selector: 'Last fetched: [relative time from last_signal_ingestion_at]' or 'Never fetched yet'

### 'Fetch now' button
- Always visible when ingestion is enabled
- Calls update-org-settings with `{signal_ingestion_enabled: true}` to trigger immediate ingest
- Shows spinner + 'Fetching signals...' during call
- On success: refreshes last_signal_ingestion_at timestamp display

### Data source API keys section
- One card per optional data source: Reddit, LinkedIn/Apify (with opt-in checkbox + disclaimer), Twitter, NewsAPI, Tavily, Brave Search, Clearbit, YouTube
- Each card: key_name label, masked input field (type=password), Save button (calls save-data-source-key), Delete button (calls delete-data-source-key, requires confirmation dialog)
- Status badge: 'Key set' (green) or 'Not configured' (grey)
- All fields disabled with tooltip 'Contact your admin to change this setting.' for Member role users
- LinkedIn card shows opt-in checkbox first: 'I understand LinkedIn data is fetched via a third-party scraper (Apify) and raw data is not retained beyond 24 hours.' Field hidden until checked.

### Custom data sources section
- Free text area: one source per line
- Accepted formats: competitor names, LinkedIn URLs, RSS URLs, publication names, subreddit names, YouTube channel URLs, podcast RSS URLs
- Validate on Save: each line parsed and feed_config created
- Show per-line validation errors

---

## PART 5 — /dashboard Trend Dashboard

Create `apps/web/app/(dashboard)/dashboard/page.tsx` and components in `apps/web/components/signals/`.

### Signal feed (spec Section 11.3):
- Fetches signals via Supabase client: `SELECT * FROM signals WHERE org_id = $org_id AND status != 'dismissed' ORDER BY relevance_score DESC, published_at DESC`
- TanStack Query `useQuery` with 60-second refetch interval

### Filter bar:
- Date range: 7 days / 30 days / 90 days / All — filters `published_at`
- Source type: dropdown from distinct source_types in fetched signals
- Tags: multi-select from distinct tags values

### Signal cards (SignalCard component):
- Headline, source name + icon, time ago (relative), relevance score badge (green >0.7 / amber 0.4-0.7 / grey <0.4), matched_themes chips
- 'Use this trend' button → `/create?signal_id={id}`
- 'Dismiss' button → Supabase client UPDATE signals SET status='dismissed', dismissed_at=now(), dismissed_by=user.id. Optimistic update.

### Dismissed signals toggle:
- 'Show dismissed' toggle at top. When ON: also fetches status='dismissed' signals. Dismissed cards show 'Restore' button → UPDATE signals SET status='unread', dismissed_at=null, dismissed_by=null

### Empty states:
- New user, no signals yet: 'Your first signals will appear within 15 minutes. We are scanning your configured sources.' with animated loading indicator
- All dismissed: 'No new signals. Check back soon, or add more sources in Settings.'

### Usage meter in header:
- `images_used / image_quota   videos_used / video_quota` — fetched from orgs table
- Shown in `apps/web/components/layout/Header.tsx`

Install shadcn components needed: `npx shadcn@latest add badge card switch separator skeleton`

---

## PART 6 — Cron stub functions

Create stub Edge Functions for the cron-scheduled functions not yet fully implemented:
- `supabase/functions/archive-old-signals/index.ts` — UPDATE signals SET status='archived' WHERE scraped_at < now() - INTERVAL '90 days' AND status != 'selected'
- `supabase/functions/cleanup-apify-signals/index.ts` — DELETE FROM signals WHERE source_type = 'apify_linkedin' AND scraped_at < now() - INTERVAL '24 hours' AND status != 'selected'
- `supabase/functions/reset-monthly-quotas/index.ts` — UPDATE orgs SET image_used=0, video_used=0, quota_reset_at=date_trunc('month', now()) + INTERVAL '1 month'

All three are cron-triggered: NO JWT user extraction, NO requireRole. Use service role client. Query across ALL orgs.

Deploy all via `deploy_edge_function`.

---

## PART 7 — Verification

**End-of-week test (spec Section 17 Week 2):**
1. Create a new user. Onboard with `country_code = 'IN'` (India). Verify regional sources (YourStory, Inc42, etc.) auto-created as `feed_configs` with `auto_activated=true`
2. Turn on signal ingestion in /settings
3. Within 15 minutes: signals from Indian regional RSS sources appear in /dashboard scored by relevance
4. Dismiss one signal — verify `status='dismissed'`, `dismissed_at` set, card hidden
5. Toggle 'Show dismissed' — dismissed card reappears with 'Restore' button
6. Click Restore — signal back in feed with `status='unread'`
7. Call `get_logs` on ingest-signals — no errors
