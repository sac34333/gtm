# GTM Engine — Technical & Functional Analysis

**Document date:** 22 May 2026
**Commit:** `6b02e77` on `main`
**Production URL:** `https://gtmengine.qubitlyventures.com`

---

## 1. Product Overview

GTM Engine is an AI-powered go-to-market workspace for startups and SMBs. It automates the work of a marketing team by turning live market signals into on-brand content, discovering ideal prospects, and shipping fully personalised multi-channel campaigns — all from a single loop.

**One loop to rule them all:**

```
Signals ──► Content ──► ICP Discovery ──► Campaigns ──► (back to Signals)
```

### Target Users

- Startup founders and marketing leads at companies with 1-1000 employees
- Three plan tiers: Starter (free trial), Growth ($89/mo), Pro ($110/mo), and Fully Subscribed (custom)
- Non-technical users who don't want to engineer prompts or juggle multiple tools

### Core Value Props

1. **Live signals** — Daily scored signals from across the digital landscape, tuned to your business themes
2. **Content without prompt fatigue** — Pick a tag, pick a tone, generate/refine/regenerate until it fits your brand
3. **AI-search ICP discovery** — Describe who you sell to; we surface real prospects, score fit 0-100, and enrich each one
4. **Campaigns for your prospects** — Pick channels, pick length, approve copy inline. Calendar, briefs, per-prospect copy
5. **LinkedIn-native** — Connect your LinkedIn company page and publish posts with images directly

---

## 2. Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router (Cloudflare Pages) |
| Database/Auth/Storage | Supabase (Postgres + RLS + pg_cron + Realtime) |
| Edge Functions | Deno (Supabase Edge Functions) |
| AI — Images | fal.ai (Flux, SDXL, Seedance, Kling, Veo) |
| AI — Video | fal.ai (Kling, MiniMax, LTX, Seedance) |
| AI — Text | OpenRouter → Anthropic / OpenAI / Google / DeepSeek / Perplexity |
| AI — Web Search | Perplexity Sonar (via OpenRouter) |
| Observability | Langfuse (traces + cost) |
| Error Tracking | Sentry |
| Billing | Dodo Payments (subscriptions + webhooks) |
| Styling | Tailwind CSS v3 + shadcn/ui |

### Route Structure

```
/ (root) ──────────────── Redirects to /dashboard or /login

/Public Routes/
  /login ──────────────── Email + password sign-in
  /signup ─────────────── Email + password registration (confirmation required)
  /forgot-password ─────── Password reset request
  /reset-password ─────── Set new password (via email link)
  /auth/callback ──────── OAuth redirect handler (PKCE)
  /invite/accept ──────── Team invite acceptance (auto-processed)

/Onboarding Routes/
  /create-org ─────────── Organisation name + slug creation
  /onboarding ─────────── 5-step brand/ICP setup wizard

/Dashboard Routes (authenticated, org required, onboarding required)/
  /dashboard ──────────── Trend Intelligence (signal feed + quota meters)
  /dashboard/signal/[id] ─ Signal detail + "Use this trend" CTA
  /create ─────────────── Asset generation workbench (image/video)
  /create/[job_id] ────── Result detail, version history, feedback, captions
  /library ────────────── All generated assets (grid view)
  /icp ────────────────── ICP criteria + prospect discovery table
  /icp/[id]/personalise ─ Per-prospect outreach copy generation
  /campaigns ───────────── Campaign list with filters
  /campaigns/new ───────── 3-step campaign creation wizard
  /campaigns/[id] ─────── Campaign detail (calendar, prospects, brief, Ask AI)
  /help/create-guide ───── How-to guide for asset creation
  /settings ────────────── General settings (signal ingestion)
  /settings/brand ──────── Brand & ICP settings
  /settings/billing ───── Plan management + checkout
  /settings/integrations ─ LinkedIn connection
  /settings/integrations/linkedin-setup ─ LinkedIn setup guide
  /settings/models ─────── AI model preferences + BYOK keys
  /settings/team ──────── Team management + invites
  /settings/usage ─────── AI usage statistics

/Marketing Routes/
  /blog, /blog/[slug] ─── Sanity CMS-powered blog
  /faq, /contact, /privacy, /terms
```

### Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS 14 APP ROUTER                        │
│   Server Components (auth gate, data fetching) ──────────────┐     │
│   Client Components (React Query + Zustand) ─────────────┐    │     │
│   Middleware (session refresh + security headers) ────┐   │    │     │
│                                                       │   │    │     │
└───────────────────────────────────────────────────────┼───┼────┼─────┘
                                                        │   │    │
                    ┌────────────────────────────────────┘   │    │
                    │ Supabase Client (browser)              │    │
                    │ — Auth, RLS-gated reads/writes          │    │
                    │ — Realtime subscriptions              │    │
                    │ — Storage signed URLs                  │    │
                    ▼                                        │    │
┌──────────────────────────────────────────────────────────┐    │
│                    SUPABASE EDGE FUNCTIONS                  │    │
│   ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │    │
│   │ build-prompt  │  │ generate-    │  │ generate-     │ │    │
│   │               │  │  asset        │  │  captions      │ │    │
│   └──────┬───────┘  └──────┬───────┘  └───────┬────────┘ │    │
│          │                  │                    │          │    │
│   ┌──────▼───────┐  ┌──────▼───────┐  ┌───────▼────────┐ │    │
│   │ icp-enrich   │  │ personalise   │  │ campaign-chat   │ │    │
│   └──────┬───────┘  └──────┬───────┘  └───────┬────────┘ │    │
│          │                  │                    │          │    │
│   ┌──────▼─────────────────▼────────────────────▼───────┐  │    │
│   │              _shared/ (auth, db, encryption,          │  │    │
│   │              providers, sources, enrichment)          │  │    │
│   └──────────┬───────────────────────────────────────────┘  │    │
│              │                                              │    │
│   ┌──────────▼─────────────────────────────────┐          │    │
│   │  ingest-signals │ poll-job-status │ cron    │          │    │
│   │  dodopayments-webhook │ post-to-linkedin   │          │    │
│   └──────────┬─────────────────────────────────┘          │    │
│              │                                              │    │
└──────────────┼──────────────────────────────────────────────┼────┘
               │                                              │
    ┌──────────▼──────────────────────────────────────────────▼──┐
    │                      SUPABASE POSTGRES                      │
    │   20 tables + RLS │ pg_cron │ pgvector │ Realtime │ Storage │
    └────────────────────────────────────────────────────────────┘
         │            │            │
         ▼            ▼            ▼
    ┌─────────┐  ┌──────────┐  ┌───────────────┐
    │ fal.ai  │  │OpenRouter│  │ LinkedIn API  │
    │ (AI img/│  │(AI text/ │  │(posts + ads)  │
    │  video) │  │  search) │  │               │
    └─────────┘  └──────────┘  └───────────────┘
```

---

## 3. Feature-by-Feature Analysis

### 3.1 Authentication & Organisation Management

#### Sign-up Flow
1. User enters email + password (min 8 chars) on `/signup`
2. Supabase `signUp` sends a confirmation email
3. User clicks the link → redirected to `/auth/callback?next=/create-org`
4. User creates an org (name + auto-generated slug with random suffix)
5. `create-org` edge function: creates `orgs` row, `org_members` row (role=owner), sets `app_metadata.org_id` on the user
6. Redirect to `/onboarding`

#### Organisation Lifecycle
- **Org creation**: One user creates an org. Slug must be unique (case-insensitive, hyphenated).
- **Onboarding**: 5-step wizard that populates `brand_contexts`. Step data saved incrementally via `save-onboarding`. On completion, `orgs.onboarding_complete = true`.
- **Members**: `owner` (full control + billing), `admin` (invite/remove/settings), `member` (use product only).
- **Invite flow**: Admin sends invite → `invite-user` creates `org_members` row (status=invited) → invitee clicks link → `accept-invite` activates membership → redirected to `/dashboard`.
- **Seat limits**: Enforced in `invite-user` via `try_reserve_seat()` database function.

#### Auth Middleware
- Every request passes through `middleware.ts` which refreshes the session, redirects unauthenticated users to `/login`, and redirects users without `org_id` to `/create-org`.
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) are applied to every response.

### 3.2 Onboarding — Brand & ICP Setup

The 5-step onboarding wizard collects:

| Step | Section | Fields |
|------|---------|--------|
| 1 | Company Identity | Name*, Country*, Industry*, Company Size*, Pitch*, Website, Founding Year, Description, Products/Services (up to 5), Revenue Model, Target Geographies, Target Industries, Target Company Sizes, Decision-Maker Titles |
| 2 | Voice & Tone | 5 tone sliders (0-100): Conversational↔Formal, Safe↔Bold, Human↔Corporate, Story↔Data-driven, Conservative↔Provocative. Sentence Length, Jargon Level, Emoji Usage, CTA Style, 3 Voice Examples |
| 3 | Visual Identity | Primary/Secondary/Accent brand colors (hex + picker), Visual Style (15 options), Dark/Light preference, Composition, Human Faces, Location/Set Style |
| 4 | Content Strategy | Active Themes (up to 3 in onboarding, up to 10 in settings), Competitor Names (up to 10), Topics to Avoid (up to 20), Primary/Secondary Platform, Target Posts Per Week, Timezone |
| 5 | Compliance & Guardrails | Phrases to Avoid, Visual Styles to Avoid, Cultural Sensitivities |

**Auto-seeding:** On completion, the system auto-creates feed configs based on the org's country and industry using `getRegionalSources()` + `getIndustrySources()`. This ensures the org starts receiving relevant signals immediately.

**Brand context is used by:**
- `build-prompt` — Injects brand voice, tone, competitors to avoid, visual style into AI prompts
- `generate-captions` — Uses brand tone, emoji usage, CTA style for social copy
- `icp-enrich` — Feeds brand context into web search queries
- `personalise` — Uses brand voice sliders, phrases to avoid, competitors to avoid
- `generate-campaign-brief` — Comprehensive brand grounding (all fields)
- `campaign-chat` — Brand context as system knowledge

### 3.3 Signals — Market Intelligence

#### Source Adapters (13 types)

| Source | Auth | Tier | What It Fetches |
|--------|------|------|-----------------|
| RSS | None | Custom | Any RSS 2.0/Atom feed, 20 items max |
| HackerNews | None | Platform (always on) | Algolia HN search by keywords |
| ProductHunt | None | Platform | 40 newest posts, keyword-filtered |
| GitHub | Optional token | Custom | Org events + trending repos |
| YouTube | API key | Custom | Channel search, 10 videos |
| Reddit | Client ID + Secret | Custom | OAuth flow, hot posts, keyword-filtered |
| NewsAPI | API key | Custom | "Everything" endpoint, keyword-filtered |
| Twitter/X | Bearer token | Custom | v2 recent search API |
| GDELT | None | Custom | DOC API, keyword-searched |
| LinkedIn via Apify | Apify token | Custom | Starts Apify actor, polls for results |
| Tavily | API key | Platform (always on) | AI-powered web search, budget-limited to 1 call per query per 6 hours |
| Brave Search | API key | Custom | Web search API |

**Signal ingestion flow:**
1. `pg_cron` calls `ingest-signals` every 15 minutes
2. For each org with `signal_ingestion_enabled=true` and frequency interval elapsed:
3. Load `brand_contexts` (active_themes, competitor_names) and active `feed_configs`
4. For each feed config, call the appropriate source adapter
5. For each raw signal: SHA-256 hash for dedup → relevance scoring → store if score > 0 and < 180 days old
6. Update `orgs.last_signal_ingestion_at`

**Relevance scoring (TF-IDF based):**
- Coverage (70% weight): Fraction of org's themes/competitors that match the signal
- Intensity (30% weight): Average term frequency weight of matched terms
- Signals with `relevance_score = 0` are discarded
- Themes matched via whole-phrase matching first, then partial token matching

**Dashboard UI:**
- **Quota meters** (top-right): Image usage (`X/Y`) and Video usage (`A/B`) with icons. Turn red when at capacity.
- **Ingestion disabled banner**: If `org.signal_ingestion_enabled` is falsy, a bordered alert box appears linking to `/settings` to re-enable.
- **Signal feed** with 4 filters: date range (7d/30d/90d/all), source tier (Platform/Industry/Custom), relevance tier (High/Medium/Low), dismissed toggle
- **"Last fetched" indicator**: Green pulsing dot while fetching, dimmer when idle. Shows "last fetched X ago" from `orgs.last_signal_ingestion_at`. Auto-refreshes every 60s via React Query (`refetchInterval: 60000`).
- Age-aware relevance badges on cards (≥0.25 = High if ≤30 days old)
- Signal cards: headline, source label, timestamp, relevance percentage, summary, theme chips
- Actions: Dismiss/Restore, "Use this trend" (detail page only, TODO on card)
- **Active generation jobs widget**: Up to 5 pending/processing jobs displayed in a 2-column grid. Each card shows asset type icon, subject text (truncated), status + elapsed time, and "View →" link. Subscribes to both `postgres_changes` on `generation_jobs` and broadcast channel `job:{id}` for instant completion updates. Auto-navigates to `/create/{id}` on completion.

**Ingestion settings (Settings):**
- Toggle ingestion on/off (calls `update-org-settings`)
- Frequency selector (daily/every 2d/every 3d/every 5d/monthly)
- "Fetch now" button (calls `ingest-signals` with JWT, org-scoped)
- Data source management: Platform (always on), Industry (seeded at onboarding, toggleable), Custom (user-added RSS feeds)
- API key management per source

### 3.4 Content Generation — Image & Video

#### The /create Page (Asset Generation Workbench)

**Image mode:**
1. Subject (required, 200 char max)
2. Creative direction chips: Scene (5), Lighting (5), Text & Headlines (4), Composition (4), People (4)
3. Visual style grid (5 options: Photography, Editorial, Modern Minimal, Cinematic, Abstract)
4. Mood grid (6 options)
5. Platform + aspect ratio (5 platform options with auto-mapped ratios, or 4 custom ratios)
6. Colour palette: Brand colours / Vibrant / Monochrome / Custom
7. CTA overlay text (80 char max)
8. Brand context accordion (if available)
9. Model selector (plan-gated)
10. "Generate 3 Variants" toggle
11. Generate button

**Video mode:**
1. Subject (required)
2. Creative direction chips: Camera (4), Style (5), Audio (3), Pacing (3), People (4)
3. Image-to-Video: Upload an initial frame image (PNG/JPEG/WebP, max 8 MB) or use a parent image job
4. Output settings card: Aspect ratio, Duration, Resolution, Fast mode, Audio toggle (model-dependent)
5. Negative prompt (model-dependent)
6. Brand context accordion
7. Model selector (video models: Seedance 2.0, Kling, Veo, LTX, etc.)
8. Generate button

**Generation pipeline:**

```
User clicks Generate
  → Client calls build-prompt { prompt_tags, signal_id?, step_key: "image_generation" }
    → Server assembles compiled_prompt from DB templates + brand context + tags
    → Returns { content_job }
  → Client adds model_id, provider_key, asset_type, video params to content_job
  → Client calls generate-asset { content_job, model_id, provider_key }
    → Server: auth + role check + quota check + model resolution + API key resolution
    → Server: creates generation_jobs row (status: pending)
    → Server: routes to provider (fal.ai for images/video, OpenRouter for text)
    → If sync (image): deducts quota, marks completed, triggers caption generation
    → If async (video): deducts quota, returns { job_id, status: pending }
```

**Video generation UX:**
- On submit, the page shows an animated pulse with "Generating your video..." text and a note that "Video is generated asynchronously. You can leave this page."
- The client subscribes to a Supabase Realtime broadcast channel `job:{jobId}` for `job_complete` events.
- As a fallback, the client also polls the job every 3 seconds via `generation_jobs` query.
- The `ActiveGenerationJobs` widget on `/dashboard` also monitors the job and auto-navigates to `/create/{job_id}` on completion.
- `poll-job-status` cron runs every minute and sends an email notification when a video job completes.

**Post-generation:**
- **Captions**: `generate-captions` runs fire-and-forget after image completion. Generates LinkedIn, X, Instagram, WhatsApp captions from brand voice + asset context. Each platform gets its own prompt template. The caption blob is stored as JSON in `generation_jobs.captions` with `_status` tracking (pending/ready/failed). A `captions_ready` broadcast event signals the UI to update instantly.
- **Refinement system**: "Refine" button opens a full-screen slide-over panel with:
  - **Refinement options** loaded from `refinement_options` table (org overrides take precedence over global defaults). Options are grouped by type:
    - `chip`: Clickable text options (e.g., "Make it more energetic", "Add more contrast")
    - `strength`: 1-5 slider controlling how strongly the refinement is applied
    - `toggle`: Boolean switches (e.g., "Keep original composition")
  - **Custom text input** for freeform instructions (max 1500 chars, additional_notes)
  - Re-calls `build-prompt` with the original `prompt_tags` + refinement instructions + `parent_job_id`, then calls `generate-asset`.
  - Result page shows side-by-side "Keep original" / "Use refined" comparison.
  - All versions linked via `parent_job_id` forming a version tree.
- **Version history**: All versions (original + refinements) are linked via `parent_job_id`. The job detail page shows a horizontal thumbnail strip at the top plus a sidebar list on the right. Each version shows thumbnail, version number, date, generation time, style tag, and status badge. Clicking navigates to `/create/{version_id}`.
- **Feedback**: Thumbs up/down, 1-5 star rating, optional text note. Stored in `generation_feedback` with upsert on `(job_id, user_id)` so users can change their vote.
- **Download**: Signed URL with auto-refresh on expiry. Filename format: `{orgSlug}_{date}_{jobIdShort}.{ext}`. If the signed URL has expired, the client re-fetches a fresh one automatically.
- **Use for campaign**: Links to `/icp?job_id=<id>` for personalisation or `/campaigns/new` for campaign creation.

**Quota system:**
- Starter: 50 images, 5 videos (hard limits)
- Paid plans: configurable per product tier
- Client-side check before generation; server-side 402 enforcement
- Video quota consumed on job creation; refunded by `poll-job-status` on failure
- Monthly reset via `reset-monthly-quotas` cron (1st of month)

### 3.5 ICP — Ideal Customer Profile & Prospect Discovery

#### /icp Page — Prospect Discovery

**ICP Criteria Form:**
- Industries (MultiSelect from ~55 B2B industries)
- Company Sizes (MultiSelect from 5 ranges)
- Geographies (MultiSelect from 40 countries)
- Job Titles (TagInput, max 10)
- Keywords (TagInput, max 10)
- Domains (TagInput, max 10)
- Per-run limit dropdown (5/10/20/50/100/200/500, tier-dependent)
- "Find Prospects with AI" button
- "Rescore Existing" button (recomputes ICP scores without web search)

**Prospect Table:**
- Columns: Name, Title, Company, ICP Score (colour-coded badge), ICP Fit Reason, Status dropdown (new/contacted/replied/qualified/disqualified), Contact Source, Last Contacted, Actions
- 3 filter dropdowns: Status, Contact Source, Campaign
- CSV Export button
- "Recent Runs" table: last 20 enrichment runs with criteria summary, model, count, status, and "Reuse" button

**Enrichment flow (`icp-enrich`):**

```
User clicks "Find Prospects with AI"
  → Client POSTs { criteria, max_results } to icp-enrich
  → Server validates, saves criteria to brand_contexts.last_icp_criteria
  → Server resolves model (org preference > available_models default > Perplexity Sonar)
  → Server calls enrichWebSearch() — Perplexity Sonar with structured prompt
    → Prompt includes: ICP criteria, brand context, explicit instruction to NOT hallucinate
    → Requires each prospect to have at least one verifiable URL
    → Deduplicates by LinkedIn URL and name+company
  → Server computes ICP scores (industries=25%, titles=25%, company_sizes=20%, geographies=20%, keywords=10%)
  → Server merges with existing prospects (dedup by linkedin_url > email > name+company)
  → Server upserts into prospects table
  → Server logs to icp_enrichment_runs
  → Returns { prospects, total, enrichment_sources_used, warning, limits }
```

**Paid enrichment waterfall (coded but disabled):** PDL → Apollo → Hunter → Clearbit → Web Scrape

#### /icp/[prospect_id]/personalise — Outreach Personalisation

- Left panel: Prospect card with ICP score, enrichment details, lifecycle status dropdown
- Right panel: Platform selector (LinkedIn/Email/Twitter/Cold DM/Facebook), Campaign job selector, Generate button
- `personalise` edge function: Takes prospect_id + job_id + platform, assembles brand voice + prospect context + campaign asset context, generates personalised outreach copy via LLM
- Copies stored in `outreach_copies` with `status: draft`
- User can approve (status → approved), copy to clipboard (status → exported), or regenerate
- Auto-advances prospect lifecycle: `new → contacted`, stamps `contacted_via` and `last_contacted_at`

### 3.6 Campaigns

#### /campaigns — Campaign List

- Filter by status (All/Draft/Active/Paused/Completed) and type (All/Awareness/Lead Gen/Nurture/Product Launch)
- Campaign cards show: asset thumbnail, name, type badge, status badge, date range, channel icons, prospect count, copy progress bar
- "New Campaign" button → `/campaigns/new`

#### /campaigns/new — 3-Step Campaign Wizard

**Step 1 — Basics:**
- Name (120 char), Campaign Type (4 tiles with auto-suggested channels), Goal, Key Message, Description, Start/End dates, Duration presets (7/14/21/30 days or custom 1-90), Working Days Only checkbox

**Step 2 — Channels & Asset:**
- Channel mix tiles (LinkedIn DM, LinkedIn Post, Facebook Post, Email, Cold DM, Twitter/X) with "Recommended" badges per type
- Creative asset grid (last 24 completed images with signed thumbnails)

**Step 3 — Add Prospects:**
- Multi-select from ICP table (up to 100, sorted by ICP score)
- Select All / Clear / Skip for now

#### /campaigns/[id] — Campaign Detail (4 Tabs)

**Tab: Calendar**
- If no brief: "Generate Brief" CTA
- If brief exists: Audience profile card, executive summary with rationale, key messages, primary CTA, day-by-day launch arc (phases: pre_launch/launch/sustain/recap), channel timing, hashtag bank, regenerate button
- Realtime updates via Supabase broadcast

**Tab: Prospects & Copy**
- Table: rows = prospects, columns = ICP score + one per channel
- Each cell shows copy status (draft/approved/rejected)
- Click to expand: full text, approve/reject/reset buttons, copy to clipboard
- "Generate copies" / "Regenerate copies" button

**Tab: Brief & Assets**
- Linked asset, PDF embed, download, regenerate

**Tab: Ask (Campaign Chat)**
- Only visible when LinkedIn is connected
- Per-campaign AI chat with context: brand voice, campaign brief, prospects, recent signals, LinkedIn ad metrics
- Daily cap: 50 messages / 200K tokens per workspace
- Rate limit: 6 messages per minute burst cap
- Chat history scoped per campaign

**Campaign brief generation (`generate-campaign-brief`):**

```
User clicks "Generate Brief"
  → Server gathers: campaign, prospects, brand context, generation job, org settings
  → Server computes audience profile (industries, titles, company sizes, geographies, ICP scores)
  → Server selects campaign type arc:
    - product_launch: pre_launch → launch → sustain → recap
    - lead_gen: problem_framing → solution → proof → ask
    - nurture: value_share → relevance → peer_proof → soft_ask
    - awareness: warm_up → peak
  → Server assembles massive structured prompt (~25 sections) including:
    - Brand grounding (voice, tone, competitors to avoid, phrases to avoid)
    - Channel playbooks (LinkedIn, Email, Twitter/X, Facebook, Cold DM)
    - Duration guidance
    - JSON output schema
  → Server calls routeTextGeneration() with JSON response format
  → Server parses response, generates PDF using pdf-lib
  → For each prospect × channel: generates personalised outreach copy
  → Server uploads PDF to Storage, updates campaign_briefs row
  → Auto-promotes campaign from draft → active
  → Returns { brief_id, pdf_url, copy_count, channel_summary }
```

**Campaign brief PDF structure:**
1. Cover page (org name, campaign name, date)
2. Audience profile (total prospects, top industries, seniorities, company sizes, geographies, average ICP score)
3. Executive summary + rationale ("Why this brief was built this way")
4. Key messages + primary CTA
5. Day-by-day launch arc (phases color-coded: amber=pre_launch, indigo=launch, emerald=sustain, violet=recap)
6. Channel content sections (LinkedIn posts, email variants, Twitter threads, DM templates, Facebook posts)
7. Hashtag bank (grouped: branded, industry, general, niche, regional)
8. Timing recommendations (best times per channel per day)
9. Footer

**`copies_only` mode:**
When "Regenerate copies" is clicked (on the Prospects & Copy tab), `generate-campaign-brief` is called with `copies_only: true`. This skips brief generation, PDF creation, and campaign status promotion. It only regenerates outreach copies for each prospect × channel combination, then stamps `updated_at` and auto-promotes `draft → active`.

### 3.7 Asset Library

- Grid of all generation jobs (images and videos) with stacked version display
- Signed URLs auto-refreshed for viewing
- Actions per card: Detail view, Animate to video, Post to LinkedIn, Delete
- Feedback overlay (thumbs up/down from `generation_feedback`)
- Auto-refresh every 5 seconds for pending/processing jobs
- Filter by type (All/Image/Video)
- Note: 30-day auto-deletion policy (handled outside the reviewed scope)

### 3.8 LinkedIn Integration

**Connect flow:**
1. User creates a LinkedIn App via the developer portal (7-step guide at `/settings/integrations/linkedin-setup`)
2. User generates a 60-day access token and finds their Ad Account ID
3. User pastes token + ad account ID + display name into the integrations page
4. Three mandatory consent checkboxes must be checked before the "Connect LinkedIn" button is enabled:
   - "I am authorized to use this LinkedIn account for my organisation"
   - "I understand my access token will be encrypted and stored securely"
   - "I agree to the Terms of Service regarding LinkedIn data usage"
5. `save-linkedin-connection` validates the token against LinkedIn's `/rest/adAccounts/{id}` API before storing it. If the API returns 401/403, the connection is rejected. If it returns a non-2xx status (e.g., 404 for an account without ads), a soft warning is issued but the connection is still saved.
6. Token is encrypted with AES-256-GCM and stored in `org_linkedin_connections`

**Post to LinkedIn:**
- Compose dialog with 3000-char limit, optional image attachment from library or upload
- `post-to-linkedin` handles image upload (LinkedIn's initializeUpload + binary PUT) and post creation
- Posts are visible on the org's LinkedIn company page

**Browse posts:**
- `get-linkedin-posts` discovers administered orgs, fetches last 20 posts per org
- Shows post type (Personal/Company), media type, preview text, relative time, "View on LinkedIn" link

**Ad metrics (via campaign chat):**
- If LinkedIn is connected, campaign chat can pull live ad metrics (impressions, clicks, spend) into the conversation context

### 3.9 Settings

#### General Settings (Signal Ingestion)
- Toggle ingestion on/off
- Ingestion frequency (daily/every 2d/3d/5d/monthly)
- "Fetch now" button (triggers immediate ingestion for this org only)
- Data sources: Platform tier (always on), Industry tier (seeded at onboarding), Custom tier (user-added RSS)
- API key management per source provider

#### Brand & ICP Settings
- All 5 onboarding sections in expandable card format
- Additional fields vs. onboarding: Differentiators, Proof Points, up to 10 active themes (vs 3)
- File uploads: Brand logo (images), Brand guidelines PDF
- Each section saves independently via `save-onboarding`

#### Billing & Plan Management
- 4 plan tiers with usage meters (Images, Videos, Seats, ICP runs)
- "Upgrade" button creates a Dodo Payments checkout session
- Webhook-driven plan updates (subscription.created/updated/cancelled)
- Seat limit enforcement on invite

**Plan definitions (hardcoded in frontend + `subscription_plans` table):**

| Plan | Price | Seats | Images | Videos | ICP | Briefs |
|------|-------|-------|--------|--------|-----|--------|
| Starter (Free) | $0 | 2 | 5 | 2 | 0 | 0 |
| Starter 1m | $120/mo | 3 | 25 | 5 | 100 | 20 |
| Growth 3m | $89/mo | 5 | 30 | 5 | 150 | 50 |
| Pro 6m | $110/mo | 8 | 45 | 8 | 200 | 100 |

#### Model Preferences (AI Model Selection)
- 9 configurable generation steps: Image Generation, Video Generation, Prompt Assembly, Outreach Copy, ICP & Prospects, Social Captions, Campaign Brief, Brand Embedding, Relevance Scoring
- Each step shows compatible models from `available_models` with cost badges
- Per-org preferences saved to `org_model_preferences`
- BYOK (Bring Your Own Keys): Only available on Fully Subscribed plan. Supports OpenAI, Anthropic, and other provider API keys (AES-256-GCM encrypted)
- Provider key status pills: "Your key" / "Platform key" / "No key"

#### Team Management
- Seat usage bar (active + pending out of seat_limit)
- Members table with role badges, status, invite actions
- Invite: email + role (admin/member), calls `invite-user`
- Remove/Change role (owner/admin only, cannot remove self or last admin)

#### AI Usage Statistics
- Period tabs: Today, 7d, 30d, All time
- Two cards: Platform calls (cost) and Your API key calls (cost)
- Table: Provider, Model, Step, Calls, Input/Output Tokens, Est. Cost, Key Source

### 3.10 Billing & Subscription Lifecycle

**Flow:**
1. User selects a plan → `create-checkout-session` creates a Dodo Payments checkout
2. User completes payment on Dodo's hosted checkout page
3. Dodo sends webhook events to `dodopayments-webhook`:
   - `subscription.created/updated/active/renewed`: Updates `orgs` with new plan_tier, quotas, seat limits
   - `subscription.cancelled/deleted/expired`: Reverts to free tier
   - `invoice.paid/payment.succeeded`: Resets usage counters (image_used, video_used)
4. Frontend re-checks session on redirect

**Webhook security:** HMAC-SHA256 signature verification against `DODO_WEBHOOK_SECRET`. Rejects invalid signatures with 401.

### 3.11 AI Model Routing

The system uses a 3-tier model resolution chain:

1. **Org preference** (`org_model_preferences`): Per-org overrides for each step
2. **Default model** (`available_models.default_for_step_key`): System-configured defaults
3. **Hardcoded fallback** (in edge function code): Last resort per step

**Provider routing:**

| Provider | Used For | Auth |
|----------|----------|------|
| OpenRouter | Text generation, web search | Platform key or BYOK |
| fal.ai | Image generation (Flux, SDXL) | Platform key |
| fal.ai | Video generation (Kling, MiniMax, LTX, Seedance, Veo) | Platform key |
| Perplexity | Web search (Sonar models) | Via OpenRouter |
| Google AI Studio | Gemini models | Platform key or BYOK |
| DeepSeek | Text models | Via OpenRouter |
| Anthropic | Claude models | Platform key or BYOK |
| OpenAI | GPT models | Platform key or BYOK |

**Cost tracking:** Every LLM call is logged to `llm_usage_events` with input/output tokens, estimated cost, model, provider, step, key source (platform vs. BYOK), and latency.

### 3.12 Security Model

- **Row-Level Security**: Every org-scoped table has RLS policies enforcing `org_id = current_org_id()`. No cross-tenant data access is possible.
- **JWT org claims**: `app_metadata.org_id` is the source of truth for org membership. Edge functions use `extractOrgId(user)` to validate UUID format.
- **API key encryption**: All provider and data source keys are encrypted with AES-256-GCM before storage. Keys are never returned to the frontend after saving.
- **CORS**: Restricted to `https://gtmengine.qubitlyventures.com` and `http://localhost:3000`.
- **Input validation**: 1MB body size limit on most user-facing functions. Zod schemas used in `create-campaign` and `generate-campaign-brief`.
- **Cron authentication**: `ingest-signals`, `poll-job-status`, `archive-old-signals`, `cleanup-apify-signals`, `reset-monthly-quotas` all require `x-cron-secret` header.
- **Webhook authentication**: Dodo Payments webhook verifies HMAC-SHA256 signature.

---

## 4. Entity Lifecycles & State Machines

### 4.1 Campaign Status Lifecycle

```
draft ──► active ──► paused ──► active (resume)
                 ├──► completed
                 └──► (deleted/archived via update-campaign)
```

- `draft`: Initial state on creation. No brief generated yet.
- `active`: Auto-promoted when brief is generated (`generate-campaign-brief` sets status to `active`). Also promoted by `copies_only` mode on first brief generation. Manually settable via status dropdown.
- `paused`: Set via the campaign status dropdown on the detail page. Uses optimistic update with rollback on error.
- `completed`: Set manually via the status dropdown.

### 4.2 Generation Job Status Lifecycle

```
pending ──► processing ──► completed
                └──► failed
```

- `pending`: Created immediately on `generate-asset` call. For videos, this is the state while the provider processes.
- `processing`: Intermediate state for some providers. `poll-job-status` cron checks every minute.
- `completed`: Image appears inline (sync) or video URL becomes available (async via Realtime broadcast).
- `failed`: Provider error or timeout. Quota is refunded by `poll-job-status`. User sees a red error card with "Try again" button.

### 4.3 Prospect Status Lifecycle

```
new ──► contacted ──► replied ──► qualified
                 └──► disqualified
```

- `new`: Default on creation from ICP enrichment.
- `contacted`: Auto-set when `personalise` or `generate-campaign-brief` generates copy for this prospect. Never downgrades: if already `replied`, stays `replied`.
- `replied`/`qualified`/`disqualified`: Manually set via the status dropdown on the ICP table.

### 4.4 Outreach Copy Status Lifecycle

```
draft ──► approved ──► exported
   └──► rejected
```

- `draft`: Default on creation from `personalise` or `generate-campaign-brief`.
- `approved`: Set when user clicks "Approve" on the personalise page or in the campaign prospects tab.
- `exported`: Set when user clicks "Copy to clipboard".
- `rejected`: Set when user clicks "Reject" in the campaign prospects tab.

---

## 5. Data Model Summary

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `orgs` | Core org entity | `plan_tier`, quotas, usage counters, Dodo billing IDs, signal ingestion config |
| `org_members` | Membership + role | `user_id`, `org_id`, `role` (owner/admin/member), `status` |
| `brand_contexts` | Brand profile | `company_name`, tone sliders, visual style, ICP criteria, competitors, themes |
| `feed_configs` | Signal source configs | `source_type`, `source_url`, `keywords`, `is_active`, `auto_activated` |
| `signals` | Market signals | `headline`, `url`, `relevance_score`, `matched_themes`, `matched_keywords`, `status` |
| `generation_jobs` | AI generation jobs | `status`, `asset_type`, `output_url`, `prompt_tags`, `model_id`, `parent_job_id`, `captions` |
| `generation_feedback` | User feedback on jobs | `thumbs`, `rating`, `feedback_text`, `tags_changed` |
| `prospects` | ICP-matched prospects | `icp_score`, `icp_fit_reason`, `enrichment_data`, `linkedin_url`, `contacted_via` |
| `campaign_briefs` | Campaign container | `name`, `campaign_type`, `status`, `brief_data`, `pdf_url`, `channel_mix` |
| `campaign_prospects` | M2M campaign↔prospect | `campaign_id`, `prospect_id`, `status` |
| `campaign_chat_messages` | Per-campaign chat | `role`, `content`, `token_count` |
| `outreach_copies` | Per-prospect copy | `platform`, `copy_text`, `status` (draft/approved/exported) |
| `icp_enrichment_runs` | Enrichment tracking | `criteria`, `source`, `prospect_count`, `status` |
| `prompt_templates` | AI prompts | `step_key`, `section_key`, `template_text`, `is_active`, `org_id` |
| `available_models` | Model catalog | `model_id`, `provider_key`, `default_for_step_key`, `cost_tier`, `is_active` |
| `org_model_preferences` | Per-org model picks | `step_key`, `model_id`, `provider_key` |
| `org_api_keys` | Data source keys | `source_type`, `encrypted_key` |
| `org_provider_api_keys` | LLM provider keys | `provider_key`, `encrypted_key` |
| `org_linkedin_connections` | LinkedIn tokens | `encrypted_access_token`, `ad_account_urn`, `consent_given_at` |
| `subscription_plans` | Plan catalog | `tier_key`, `dodo_product_id`, quotas |
| `llm_usage_events` | Cost tracking | `model`, `provider`, `step`, `input_tokens`, `output_tokens`, `cost_usd` |

---

## 6. Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `ingest-signals` | Every 15 min | Fetch new signals for all orgs |
| `poll-generation-jobs` | Every 1 min | Check async video jobs for completion, send notification emails |
| `archive-old-signals` | Daily at 02:00 UTC | Mark signals >90 days as archived |
| `cleanup-apify-signals` | Hourly | Clean up stale Apify LinkedIn signal records |
| `reset-monthly-quotas` | 1st of month 00:00 UTC | Reset image_used and video_used counters |

---

## 7. Edge Functions (38)

| Function | Auth | Purpose |
|----------|------|---------|
| `accept-invite` | JWT | Process team invite tokens |
| `add-campaign-prospects` | JWT (member+) | Link prospects to a campaign |
| `archive-old-signals` | Cron | Mark signals >90 days as archived |
| `build-prompt` | JWT (self-verify) | Assemble AI prompt from templates + brand context + tags |
| `campaign-chat` | JWT (self-verify) | Per-campaign AI chat with brand/prospect/signal context |
| `check-quota` | JWT | Return org's image/video quota and usage |
| `cleanup-apify-signals` | Cron | Remove stale Apify signal records |
| `create-campaign` | JWT (self-verify) | Create a new campaign (draft status) |
| `create-checkout-session` | JWT | Create Dodo Payments checkout URL |
| `create-org` | JWT | Create org + set org_id in auth metadata |
| `delete-asset` | JWT | Delete generation job + storage object |
| `delete-data-source-key` | JWT | Remove an org's data source API key |
| `delete-linkedin-connection` | JWT | Disconnect LinkedIn for the org |
| `delete-provider-key` | JWT | Remove an org's BYOK provider key |
| `dodopayments-webhook` | HMAC | Process Dodo billing events (plan updates, quota resets) |
| `generate-asset` | JWT (self-verify) | Create image/video via AI, manage quota, store result |
| `generate-campaign-brief` | JWT (self-verify) | Generate AI campaign brief + PDF + outreach copies |
| `generate-captions` | JWT (self-verify) / Cron | Generate social captions for a completed asset |
| `get-available-models` | JWT | Return model catalog + org preferences + plan info |
| `get-linkedin-posts` | JWT | Fetch recent LinkedIn posts for connected org |
| `get-upload-url` | JWT | Generate signed upload URL for Supabase Storage |
| `get-usage-stats` | JWT | Return AI usage statistics for the org |
| `icp-enrich` | JWT (self-verify) | Search for prospects matching ICP criteria |
| `ingest-signals` | Cron / JWT | Fetch signals from all configured sources |
| `invite-user` | JWT (admin+) | Send a team invite email |
| `personalise` | JWT (self-verify) | Generate personalised outreach copy for a prospect |
| `poll-job-status` | Cron / Service | Check async video generation jobs for completion |
| `post-to-linkedin` | JWT | Publish a post (with optional image) to LinkedIn |
| `remove-member` | JWT (admin+) | Remove a member from the org |
| `reset-monthly-quotas` | Cron | Reset all orgs' monthly image/video usage counters |
| `save-data-source-key` | JWT | Encrypt and store a data source API key |
| `save-linkedin-connection` | JWT | Validate and store LinkedIn access token |
| `save-model-preferences` | JWT (admin+) | Save org's model preference overrides |
| `save-onboarding` | JWT | Save onboarding data incrementally |
| `save-provider-keys` | JWT (admin+) | Encrypt and store BYOK provider API keys |
| `submit-feedback` | JWT (member+) | Record user feedback on a generation job |
| `update-campaign` | JWT (self-verify) | Partial update on a campaign |
| `update-org-settings` | JWT | Update org settings (ingestion toggle, frequency, name) |

---

## 8. Realtime & Live Updates

| Channel | Events | Used By |
|---------|--------|---------|
| `postgres_changes` on `generation_jobs` | UPDATE | ActiveGenerationJobs widget (status changes) |
| `broadcast` channel `job:{jobId}` | `job_complete`, `captions_ready` | Job detail page, SocialCopySection, ActiveGenerationJobs |
| `postgres_changes` on `campaign_briefs` | UPDATE | Campaign detail page (brief status) |
| `broadcast` channel `campaign:{id}` | `brief_complete` | Campaign detail page |

---

## 9. Mobile Experience

The dashboard uses a responsive layout with a `MobileShell` component for viewports < 768px:

- **Top bar**: Fixed iOS-style bar with centered title (derived from pathname) and a hamburger menu on the left. On nested routes (e.g., `/campaigns/[id]`), the hamburger is replaced by a "Back" button.
- **Drawer**: Slide-out navigation drawer with the full `SidebarNav` contents. Includes a "Sign out" button at the bottom (ensures it's reachable even on small screens). Drawer auto-closes on route change via `useEffect`. Body scroll is locked while the drawer is open.
- **Filter chips**: On `/campaigns`, filter chips scroll horizontally within their container bar; the outer page does not scroll horizontally.
- **Touch targets**: All interactive elements are at least 36px tall.
- **Asset previews**: Images and videos fit 100% width with no horizontal overflow.
- **Tables**: The ICP prospects table scrolls horizontally within its container.
- **Social copy**: "Ready" status and "Regenerate all" text are visible (not greyed/invisible on dark mode).

Desktop at 1440px+ is pixel-identical to pre-mobile-layout designs.

---

## 10. Brand File Upload Flow

Brand assets (logos and guidelines PDFs) follow a signed-upload pattern:

1. **File selection**: User clicks "Upload logo" or "Upload guidelines" in the Brand & ICP settings form (`BrandFileUpload` component).
2. **File validation**: Client-side check for allowed types (PNG, JPEG, SVG, WebP for images; PDF for guidelines) and size limits.
3. **Signed URL request**: Client calls `get-upload-url` edge function with `{ bucket: 'brands', filename, content_type }`. The function returns a pre-signed PUT URL scoped to `{org_id}/{filename}`.
4. **Direct upload**: Client PUTs the file binary directly to the signed URL (bypassing the edge function).
5. **Path persistence**: Client calls `save-onboarding` with the storage path to persist it on the `brand_contexts` row.
6. **Viewing**: When the settings page loads, `get-upload-url` generates a 1-hour signed URL for viewing the stored file.

For **image-to-video (i2v) source uploads**, the same pattern applies but with `{ bucket: 'assets', filename, content_type }` and the path is restricted to `{org_id}/i2v_sources/{filename}`.

---

## 11. Error Handling & UI Patterns

### Toast Notifications (via `sonner`)
- Success, error, and info toasts for all mutation operations (save, generate, delete, invite, etc.).
- Supabase error messages are surfaced to the user (e.g., "Failed to dismiss signal").
- Auth errors (`401`) trigger a redirect to `/login`.

### Inline Validation
- `/create` page: Subject is required (inline red border + message). Creative direction chips are optional.
- `/signup` and `/login`: Email format validation, password min-length check.
- `/onboarding` Step 1: Company name, country, industry, company size, and pitch are required.

### Quota Exceeded Modal
- Triggered when `generate-asset` returns HTTP 402.
- Shows current usage (`X images of Y`, `A videos of B`), plan name, next reset date.
- "Upgrade" button links to `/settings/billing`.
- "Try again later" dismiss option.

### Optimistic UI Updates
- **Signal dismiss/restore**: Instant card removal or restoration without refetch. Uses React Query `setQueryData` to mutate cache directly.
- **Campaign status dropdown**: Dropdown changes status immediately; on error, rolls back to previous status with a toast.
- **LinkedIn post compose**: Compose dialog closes immediately; post creation happens asynchronously.
- **Chat message send**: User message appended immediately; on LLM error, the optimistic message is removed and the input text is restored for retry.

### Error Boundaries
- `global-error.tsx`: Catches unhandled exceptions in the root layout. Shows a full-page error with a "Try again" button.
- Sentry integration: All unhandled errors are reported to Sentry (conditional on `SENTRY_AUTH_TOKEN` env var).

### Rate Limiting
- Campaign chat: 6 messages per minute burst cap, 50 messages / 200K tokens per day per workspace.
- Generation: Server-side quota enforcement returns 402 when limits are exceeded.
- ICP enrichment: Monthly run cap (currently disabled with `false &&` — see Known Gaps).

---

## 12. Content Management (Sanity CMS)

The `/blog` and `/blog/[slug]` pages are powered by **Sanity CMS** via `@sanity/client`. A separate Sanity Studio app exists in the `studio/` directory (`gtmengine-studio`) for authoring blog content.

- Blog content is rendered using `@portabletext/react` for rich text.
- The marketing layout wraps blog, FAQ, contact, privacy, and terms pages.
- Public pages (login, signup, etc.) use the `AuthShell` component with a marketing panel showing feature highlights.

---

## 13. Known Gaps & Functional Notes

### Features Marked TODO in Code

1. **"Use this trend" button on signal cards** — Commented out with `// TODO: re-enable post-launch`. Currently only available on the signal detail page.
2. **ICP enrichment paid waterfall** — PDL → Apollo → Hunter → Clearbit → Web Scrape code is fully present in `_shared/enrichment/` but disabled. Currently only Perplexity Sonar is used.
3. **ICP run cap enforcement** — The monthly run cap check is disabled (`false &&` guard) in `icp-enrich`. All tiers effectively have unlimited runs.

### Relevance Scoring Discrepancy

- **Signal card** uses age-aware thresholds: high ≥ 0.25 (if ≤30 days old), medium ≥ 0.1
- **Signal detail page** uses raw thresholds: high ≥ 0.7, medium ≥ 0.4
- A signal showing "High" on the card can show as "Medium" or unlabelled on the detail page

### Platform Key Resolution

- `fully_subscribed` (paid) plans use environment variable API keys for signal sources
- Other plans use org-specific encrypted API keys from `org_api_keys`
- This means free/starter orgs can't use data sources that require API keys unless they add their own

### Caption Model Fallback

- `personalise` has a broken model fallback query (uses `step_key` and `is_default` columns instead of `default_for_step_key` and `is_active`)
- Every personalise call that doesn't have an org preference silently falls through to `google/gemini-2.5-flash` on OpenRouter

### Data Source Key Plan Gate (Inverted)

- `save-data-source-key` and `delete-data-source-key` block `fully_subscribed` (paid) users while allowing `starter` (free) users
- `save-provider-keys` and `delete-provider-key` correctly gate to `fully_subscribed` only
- This means paid users cannot add their own RSS/Reddit/etc. API keys in Settings

### Campaign Chat LinkedIn Integration

- The "Ask" tab only appears when LinkedIn is connected
- When connected, the chat can pull live LinkedIn ad metrics into the conversation context
- When disconnected, the tab is replaced with a locked state and CTA to connect LinkedIn

### Model Selection UX

- Only `fully_subscribed` plan + `admin` role can change model preferences
- Non-admins see "View-only" banner; admins on non-paid plans see "Locked on your current plan"
- Each step has a hardcoded default model that's used when no preference is set

### Signal Card vs Detail Page Inconsistencies

- Signal card sanitizes `signal.url` against XSS (validates scheme is `http:` or `https:`), but the signal detail page passes the URL directly to `<a href>` without sanitization.
- Signal card has the "Use this trend" link commented out (`TODO: re-enable post-launch`), but the detail page has it working.
- The signal detail page filters out archived and dismissed signals (via `.maybeSingle()`), but doesn't redirect if the signal is archived — it shows a 404 instead of a helpful message.

### Campaign Chat Daily Cap

- The daily message cap (50 messages, 200K tokens) is checked with a read-then-write race condition. Under concurrent requests, the cap can be exceeded by 1 message per concurrent request.
- Burst rate limit (6 messages/minute) is checked correctly (count-based, no race condition).

### Storage Buckets

| Bucket | Visibility | Purpose |
|--------|-----------|---------|
| `assets` | Private (signed URLs) | Generated images, videos, i2v source uploads |
| `brands` | Private (signed URLs) | Logos, brand guidelines PDFs |
| `briefs` | Private (signed URLs) | Campaign brief PDFs |

### Signed URL Expiry

- Asset viewing: 1 hour
- Brand file viewing: 1 hour  
- Upload URLs: Short-lived (Supabase default)

### Client-Side Quota Check

- The `/create` page checks quota client-side before calling `generate-asset`
- The server also enforces quota and returns 402 if exceeded
- A "Quota Exceeded" modal shows usage, quota, reset date, and upgrade CTA

---

## 14. End-to-End User Journeys

### Journey 1: New User to First Signal

```
/signup → Confirm email → /login → /create-org → /onboarding (5 steps)
  → Dashboard loads (redirects to /dashboard)
  → Auto-seeded signal sources based on country + industry
  → Within 15 minutes, signals start appearing
  → User can also click "Fetch now" for immediate ingestion
```

### Journey 2: Signal to Published Content

```
/dashboard → Click a high-relevance signal → Signal detail page
  → Click "Use this trend" → /create?signal_id=X
  → Subject pre-filled, brand context injected
  → Pick style, mood, platform → Generate image
  → Image appears within 30 seconds
  → Auto-generated social captions (LinkedIn, X, Instagram, WhatsApp)
  → Copy caption to clipboard
  → "Post to LinkedIn" (if LinkedIn connected) → Publish directly
```

### Journey 3: ICP Discovery to Personalised Outreach

```
/icp → Fill ICP criteria (industries, titles, company sizes, geographies)
  → Click "Find Prospects with AI"
  → Wait for Perplexity Sonar results (5-30 seconds)
  → Prospect table populated with scored, enriched prospects
  → Click a prospect → /icp/[id]/personalise
  → Select platform (LinkedIn DM, Email, etc.), pick a campaign asset
  → Generate personalised outreach copy
  → Approve copy → Copy to clipboard → Paste into LinkedIn/Email
```

### Journey 4: Full Campaign Creation

```
/campaigns/new → Step 1: Name, type, dates, goal
  → Step 2: Pick channels, pick an image asset
  → Step 3: Select prospects from ICP
  → Campaign created (draft status)
  → /campaigns/[id] → Click "Generate Brief"
  → Wait for AI brief generation (30-90 seconds)
  → Calendar tab: Day-by-day launch arc, channel playbooks, hashtag bank
  → Prospects tab: Per-prospect per-channel copy generated
  → Approve copies → Copy to clipboard / Send
  → Ask tab: Chat with AI about campaign performance (with LinkedIn ad metrics)
```

### Journey 5: BYOK Setup

```
/settings/models → See "Your key" status pills
  → Paste OpenAI/Anthropic/other provider API key
  → Key is AES-256-GCM encrypted and stored in org_provider_api_keys
  → Change model preferences for each step
  → All subsequent generations route through your own API key
  → Usage stats separate platform vs. your-key costs
```

---

## 15. Suggested Functional Test Priority

Based on feature criticality and demo impact:

| Priority | Feature | Key Test |
|----------|---------|----------|
| P0 | Auth flow | Signup → Confirm → Login → Dashboard |
| P0 | Onboarding | 5-step wizard → Signal sources auto-seeded |
| P0 | Signal ingestion | Wait for cron OR "Fetch now" → Signals appear |
| P0 | Image generation | Subject → Generate → Image appears → Captions show |
| P0 | ICP discovery | Criteria → "Find Prospects" → Scored results |
| P0 | Campaign creation | 3-step wizard → Brief generation → Prospect copy |
| P0 | LinkedIn posting | Connect → Compose → Publish → Verify on LinkedIn |
| P1 | Video generation | Subject → Generate → Polling → Complete |
| P1 | Refinement | Generate → Refine → Version history → Keep original/new |
| P1 | Personalisation | Prospect → Platform → Generate copy → Approve → Copy |
| P1 | Billing | Upgrade → Dodo checkout → Webhook → Plan update |
| P1 | Team management | Invite → Accept → Role change → Remove |
| P2 | BYOK keys | Save → Verify encrypted → Use → Delete |
| P2 | Data source keys | Save API keys → Ingest with sources → Verify |
| P2 | Campaign chat | Ask questions → Verify context-aware responses |
| P2 | Mobile responsiveness | All pages on 375px viewport |
| P2 | Usage stats | Generate assets → Verify stats in /settings/usage |