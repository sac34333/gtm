# GTM Engine — Master Specification for AI Coding Agent

**Version 1.0 | Pilot: Steps 1–4**

> **IMPORTANT:** This document is the single source of truth for building the GTM Engine. The AI coding agent must read every section before writing any code. Do not infer, assume, or add anything not explicitly stated here.

---

## 0. How to Use This Document

This is the complete specification for the GTM Engine pilot. It defines the objective, architecture, database schema, every Edge Function, frontend pages, data sources, brand onboarding, AI model config, payment integration, security rules, environment variables, folder structure, build order, and an explicit do-not-build list.

Conventions used:
- NOTE: — important context the agent must understand before proceeding
- RULE: — a hard constraint that must never be violated under any circumstance
- WARNING: — a risk or gotcha the agent must be aware of
- DO NOT — an explicit prohibition. If the spec does not mention it, do not build it.

> **RULE:** If this document does not describe a feature, the agent must NOT build it, assume it, or add it 'for completeness'. Build only what is written here.


---

## 1. Objective

Build a B2B SaaS GTM Intelligence Engine that automates trend discovery, AI content creation (images and video), ICP discovery, and outreach personalisation for marketing teams. The system is global-first — it must work correctly for B2B companies in India, EU, US, Australia, Africa, Middle East, and Southeast Asia without modification.


### 1.1 Pilot scope — build in v1

- Step 1 — Trend Intelligence: ingest and score market signals from multiple global data sources
- Step 2 — Content Creation: generate AI images and AI videos grounded in brand context and selected trend
- Step 3 — ICP Discovery: identify and enrich ideal customer profiles
- Step 4 — Personalisation: generate personalised outreach copy per prospect + campaign brief


### 1.2 Explicitly out of scope for v1 — do not build

- Steps 5 and 6 from the GTM diagram (Nurture & Engage, Proposal Generator)
- Direct social media posting or scheduling via any platform API
- Content calendar UI
- CRM integrations (HubSpot, Salesforce, Pipedrive, or any other)
- Email campaign sending (Mailchimp, SendGrid — Resend is for transactional only)
- Mobile app (iOS or Android)
- Public developer API
- White-label / custom domain per org
- Analytics or reporting dashboard
- A/B testing infrastructure
- Real-time collaboration or multiplayer editing
- Platform admin panel (use Supabase Table Editor for v1 operator tasks)
- Any third-party integration not explicitly listed in this document


---

## 2. System Overview


### 2.1 End-to-end user flow

1. User signs up, verifies email, creates organisation
2. User completes brand onboarding wizard (5 sections) — cannot be skipped
3. System auto-activates regional data sources based on org country
4. Background ingestor scrapes configured sources on schedule, scores signals by relevance
5. User reviews trend dashboard: ranked signal cards, filters by date/source/tag, selects or dismisses
6. User opens prompt tag editor: fills subject, style, mood, platform, aspect ratio, CTA, negative prompt
7. User selects AI model (image or video), clicks Generate
8. System assembles ContentJob JSON from tags + brand context (pgvector lookup), calls the selected AI provider (OpenRouter, fal.ai, Google AI Studio, Anthropic, or OpenAI) via the provider router
9. Image: ready in ~30s, shown immediately. Video: async job, user notified by email + Realtime when done
10. User reviews asset, rates it (thumbs + stars), downloads or regenerates with adjusted tags
11. User defines ICP criteria, system enriches prospects via waterfall (PDL → Apollo → Hunter → Clearbit → web scrape)
12. System generates personalised outreach copy per prospect using approved asset + brand voice
13. System produces campaign brief: posting schedule, caption variants per platform, hashtags, timing by timezone
14. User downloads campaign brief PDF or copies content


### 2.2 User roles

Three roles exist per org. Role is stored in org_members.role and read from the JWT claim (set via Supabase Auth hook). Every Edge Function that performs a write or sensitive read must call requireRole(jwt, minRole) before any DB operation.

| Role | Who | Description |
| --- | --- | --- |
| Owner | The person who created the org / signed up | Full access to everything. One owner per org. Cannot be demoted or removed except by deleting the org. |
| Admin | Invited power users | All content features + org configuration. Cannot touch billing or change plan. |
| Member | Standard invited users | Content features only. Read-only on settings. Cannot manage any keys, seats, or org config. |

### 2.2.1 Role access matrix

Every feature and route is governed by the minimum role required. Edge Functions enforce this via requireRole(jwt, minRole). The frontend hides restricted UI elements for lower-role users but backend enforcement is the authoritative gate.

| Feature / Action | Member | Admin | Owner |
| --- | --- | --- | --- |
| **Content** | | | |
| View trend dashboard (/dashboard) | ✓ | ✓ | ✓ |
| Dismiss / restore signals | ✓ | ✓ | ✓ |
| Use a trend (go to /create) | ✓ | ✓ | ✓ |
| Generate image or video | ✓ | ✓ | ✓ |
| View generation result, download asset | ✓ | ✓ | ✓ |
| Submit generation feedback (thumbs/stars) | ✓ | ✓ | ✓ |
| Regenerate with changes | ✓ | ✓ | ✓ |
| Define ICP criteria (/icp) | ✓ | ✓ | ✓ |
| Run prospect enrichment | ✓ | ✓ | ✓ |
| Generate outreach copy (/icp/[id]/personalise) | ✓ | ✓ | ✓ |
| Generate campaign brief | ✓ | ✓ | ✓ |
| Download campaign brief PDF | ✓ | ✓ | ✓ |
| **Org Settings (/settings)** | | | |
| View /settings page | Read-only | ✓ | ✓ |
| Add / edit custom data sources | ✘ | ✓ | ✓ |
| Toggle signal ingestion on/off | ✘ | ✓ | ✓ |
| Change ingestion frequency | ✘ | ✓ | ✓ |
| 'Fetch now' on-demand ingest | ✘ | ✓ | ✓ |
| Add / replace / delete data source API keys (Reddit, YouTube, Tavily, etc.) | ✘ | ✓ | ✓ |
| **AI Model Settings (/settings/models)** | | | |
| View /settings/models page | Read-only | ✓ | ✓ |
| **AI Usage (/settings/usage)** | | | |
| View AI token and cost usage | ✘ | ✓ | ✓ |
| Change per-step model preferences | ✘ | ✓ | ✓ |
| Add / replace / delete AI provider keys (OpenRouter, fal, Google, etc.) | ✘ | ✓ | ✓ |
| **Team Management (/settings/team)** | | | |
| View team member list | ✓ | ✓ | ✓ |
| Invite new member | ✘ | ✓ | ✓ |
| Remove a member | ✘ | ✓ | ✓ |
| Change a member's role | ✘ | ✘ | ✓ |
| **Billing (/settings/billing)** | | | |
| View current plan and usage | ✓ | ✓ | ✓ |
| Upgrade / downgrade plan | ✘ | ✘ | ✓ |
| Manage payment method | ✘ | ✘ | ✓ |

> **RULE:** requireRole(jwt, minRole) must be called at the top of every Edge Function that performs any write, delete, or key management operation. The hierarchy is: member < admin < owner. Passing minRole='admin' allows both admin and owner. Passing minRole='owner' allows only owner. Any JWT with a role below minRole must receive HTTP 403 {error: 'insufficient_role'}.
> **RULE:** The frontend must hide buttons and nav items that the current user's role cannot access. Hidden UI is a UX convenience only — backend enforcement via requireRole is the security gate and must never be omitted.
> **NOTE:** On the Member read-only view of /settings and /settings/models: all input fields, Save buttons, Delete buttons, and toggle controls are disabled and show a tooltip 'Contact your admin to change this setting.' The page still loads and shows current values so Members can see the org's configuration.


### 2.3 Multi-tenancy — org-based isolation

Each paying client = one Organisation (org). An org has one or more users (seats). Every database row that belongs to an org has an org_id column. Supabase RLS policies enforce that a user can only see rows where org_id matches the org_id in their JWT. This is non-negotiable.

| Table | Isolation mechanism |
| --- | --- |
| orgs | Master record — one row per paying client company |
| org_members | Join table: org_id + user_id + role. One row per user per org. |
| users | Supabase Auth managed — one row per human login across all orgs |
| All other tables | org_id on every row, enforced by RLS policy described in Section 4 |

> **RULE:** The org_id must always come from the JWT claim — NEVER from the request body or URL parameters. An Edge Function that reads org_id from anywhere other than the JWT is a critical security bug.


---

## 3. Technology Stack

> **NOTE:** There is NO separate backend server. No FastAPI. No Express. No Railway. No Render. No Redis. No Celery. All backend logic runs as Supabase Edge Functions (Deno/TypeScript). All scheduling runs as Supabase Cron (pg_cron). This is a deliberate decision — do not introduce a separate compute layer.

| Layer | Technology + notes |
| --- | --- |
| Frontend framework | Next.js 14 — App Router, TypeScript, strict mode on |
| Frontend hosting | Cloudflare Pages — free tier, connected to GitHub repo for auto-deploy |
| Custom domain | gtmengine.qubitlyventures.com — DNS managed on Cloudflare |
| Styling | Tailwind CSS + shadcn/ui component library |
| State management | Zustand for client state, React Query (TanStack Query) for server state |
| API layer | Supabase Edge Functions — Deno/TypeScript — ALL backend logic lives here |
| Database | Supabase Postgres — pgvector extension must be enabled at project creation |
| Authentication | Supabase Auth — email+password — custom JWT claim for org_id |
| File storage | Supabase Storage — brand assets, generated images, generated videos, PDFs |
| Realtime | Supabase Realtime — generation job progress updates, live signal feed |
| Scheduled jobs | Supabase Cron (pg_cron) — defined in migration SQL — NO external scheduler |
| Brand embeddings | pgvector (1536-dim) — brand context embedded for semantic prompt grounding |
| AI models | Multiple providers — OpenRouter, fal.ai, Google AI Studio, Anthropic, OpenAI. Provider and model are DB-driven and user-configurable per step. Provider router in _shared/providers/ handles routing. |
| Payments | Dodo Payments — subscriptions + metered generation billing |
| Transactional email | Resend — free 3000/mo — job completion notices, invites, quota alerts |
| Error tracking | Sentry free tier on frontend + Supabase Edge Function built-in logs |
| CI/CD | GitHub Actions: deploy frontend to Cloudflare Pages + run supabase db push + supabase functions deploy |
| PDF generation | @react-pdf/renderer — campaign briefs |
| Supabase JS client | @supabase/supabase-js v2 — used in both frontend and Edge Functions |
| Runtime validation | `npm:zod` (Deno Edge Functions) + `zod` (Next.js) — validates all request bodies at the Edge Function boundary and all LLM JSON responses before use. Central schemas defined in `_shared/schemas.ts`. |

> **RULE:** Do not add any dependency not listed above without updating this document. Every new package must have a clear reason.


---

## 4. Database Schema

All tables use UUID primary keys (gen_random_uuid()). All timestamps are timestamptz. pgvector extension must be enabled before any migration runs. Migrations are numbered sequentially in /supabase/migrations/.


### 4.1 orgs

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| name | text NOT NULL — client company name |
| slug | text UNIQUE NOT NULL — URL-safe org identifier e.g. 'acme-corp' |
| country_code | text NOT NULL — ISO 3166-1 alpha-2: IN, US, GB, AU, ZA, SG, AE, NG, etc. |
| plan_tier | text NOT NULL DEFAULT 'starter' — `starter` \| `growth` \| `scale` \| `fully_subscribed`. The `fully_subscribed` tier is operator-assigned only (not self-served via Dodo Payments). Operator sets it directly in Supabase Table Editor. On this tier: org API key management UI is hidden, all AI and data source keys come from platform env vars, and seat_limit + quotas are set directly by the operator. |
| byok_mode | boolean NOT NULL DEFAULT false — Bring Your Own Keys mode. When true: the org has opted to supply their own AI provider API keys (stored in org_provider_api_keys). Platform keys are NOT used as fallback for any provider — resolveApiKey treats every provider as key_source='user_required' regardless of the available_models setting. Platform charges a reduced subscription price on this tier (reflected in Dodo product pricing). When false (default): platform keys are used as fallback for all user_or_platform models — org members never need to touch API keys. Can be toggled by the owner in /settings/models, or by the operator via Table Editor / operator-admin update_org. |
| seat_limit | integer NOT NULL DEFAULT 2 |
| image_quota | integer NOT NULL DEFAULT 50 — max images per billing cycle |
| video_quota | integer NOT NULL DEFAULT 5 — max videos per billing cycle |
| image_used | integer NOT NULL DEFAULT 0 — resets on quota_reset_at |
| video_used | integer NOT NULL DEFAULT 0 |
| quota_reset_at | timestamptz — next monthly quota reset date |
| dodo_customer_id | text — Dodo Payments customer ID |
| dodo_subscription_id | text — Dodo Payments subscription ID |
| onboarding_complete | boolean NOT NULL DEFAULT false |
| signal_ingestion_enabled | boolean NOT NULL DEFAULT false — when false, ingest-signals skips this org entirely. No signals are fetched and no source adapters are called. Saves platform API quota and compute for inactive orgs. Default false — user must explicitly activate in /settings. |
| signal_ingestion_frequency | text NOT NULL DEFAULT 'daily' — how often signals are fetched when signal_ingestion_enabled=true. Allowed values: 'daily' \| 'every_2_days' \| 'every_3_days' \| 'every_5_days' \| 'monthly'. The ingest-signals function reads this value and skips the org if insufficient time has passed since last_signal_ingestion_at. |
| last_signal_ingestion_at | timestamptz — set to now() after each successful ingest run for this org. Used with signal_ingestion_frequency to decide whether to run again. |
| created_at | timestamptz NOT NULL DEFAULT now() |
| updated_at | timestamptz NOT NULL DEFAULT now() |


### 4.2 org_members

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| user_id | uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| role | text NOT NULL — owner \| admin \| member |
| invited_by | uuid REFERENCES auth.users(id) |
| status | text NOT NULL DEFAULT 'active' — 'pending' \| 'active'. Set to 'pending' when invite-user creates the row. Updated to 'active' by accept-invite after the invitee confirms their account. Members with status='pending' cannot access the dashboard and are excluded from quota counts. |
| joined_at | timestamptz NOT NULL DEFAULT now() |

UNIQUE (org_id, user_id)

> **RULE:** The UNIQUE constraint on (org_id, user_id) prevents duplicate membership rows. invite-user must handle the INSERT conflict gracefully: if a pending row already exists for this user+org, update it (resend the invite email) rather than creating a second row.


### 4.3 brand_contexts

One row per org. Contains all brand onboarding data. The brand_context_embedding vector is generated by calling OpenRouter text-embedding model on a concatenation of key brand fields after onboarding completes.
| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE UNIQUE |
| company_name | text |
| country_code | text |
| industry_sector | text |
| company_size | text — 1-10 \| 11-50 \| 51-200 \| 201-1000 \| 1000+ |
| website_url | text |
| founding_year | integer |
| one_sentence_pitch | text — required for generation quality |
| extended_description | text |
| products_services | jsonb — array of {name: string, description: string} |
| revenue_model | text — saas \| consulting \| product \| marketplace \| other |
| target_geographies | text[] — array of ISO country codes |
| target_industries | text[] |
| target_company_sizes | text[] — smb \| mid-market \| enterprise |
| decision_maker_titles | text[] — e.g. ['VP Marketing', 'CMO', 'Founder'] |
| tone_formal_conversational | integer DEFAULT 50 — 0=fully formal, 100=fully conversational |
| tone_safe_bold | integer DEFAULT 50 |
| tone_corporate_human | integer DEFAULT 50 |
| tone_data_story | integer DEFAULT 50 |
| tone_conservative_provocative | integer DEFAULT 50 |
| sentence_length | text — short \| medium \| long |
| jargon_level | text — avoid \| moderate \| heavy |
| emoji_usage | text — never \| sparingly \| freely |
| cta_style | text — soft \| direct \| urgent |
| voice_examples | text[] — up to 3. Injected as few-shot examples into every content prompt. |
| brand_colours | jsonb — {primary: hex, secondary: hex, accent: hex} |
| visual_style | text — photography \| illustration \| abstract |
| dark_light_preference | text — dark \| light \| neutral |
| busy_minimal | text — busy \| balanced \| minimal |
| human_faces | text — yes \| no \| diverse_only |
| location_style | text — real \| studio \| abstract |
| logo_url | text — Supabase Storage path: brands/{org_id}/logo.{ext} |
| brand_guidelines_url | text — Supabase Storage path: brands/{org_id}/guidelines.pdf |
| reference_image_urls | text[] — up to 5 paths in brands/{org_id}/ref/ |
| anti_reference_image_urls | text[] — up to 3. These become negative prompt inputs. |
| active_themes | text[] — up to 3 current campaign themes. Used to score signal relevance. |
| competitor_names | text[] — up to 10. Auto-create feed_config entries + used as negative context in prompts. |
| primary_platform | text — linkedin \| twitter \| instagram \| whatsapp \| email |
| secondary_platform | text |
| posts_per_week | integer |
| timezone | text — IANA timezone string e.g. 'Asia/Kolkata', 'Europe/Berlin' |
| topics_to_avoid | text[] |
| phrases_to_avoid | text[] |
| visual_styles_to_avoid | text[] |
| sensitivities | text — political, religious, cultural notes |
| last_icp_criteria | jsonb — stores the most recently submitted ICP search criteria: {industries, company_sizes, geographies, titles, keywords, domains}. Saved by the icp-enrich Edge Function on each run so the /icp page pre-populates the criteria form on next visit. NULL until the first enrichment run. |
| brand_guidelines_text | text — raw text extracted from the brand guidelines PDF on upload. Used as additional context block in build-prompt alongside voice_examples. Stored here so Edge Functions can access it without re-parsing the PDF on every call. NULL if no guidelines PDF uploaded or if extraction failed (e.g. scanned image PDF). |
| brand_context_embedding | vector(1536) — pgvector embedding, generated post-onboarding. DIMENSION MUST MATCH the output of the brand_embedding model (Section 7.4 default: perplexity/pplx-embed-v1-0.6b via OpenRouter). Verify the exact output dimension of this model before running migration 0003. If it outputs 1024 dims (not 1536), change this column to vector(1024). OpenAI text-embedding-3-small is a confirmed 1536-dim alternative (use OPENAI_API_KEY platform env var). The column dimension and the embedding model output MUST match exactly — a mismatch causes all brand_context INSERT operations to fail with a PostgreSQL dimension error. |
| created_at | timestamptz NOT NULL DEFAULT now() |
| updated_at | timestamptz NOT NULL DEFAULT now() |


### 4.4 feed_configs

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| source_type | text NOT NULL — rss \| hackernews \| producthunt \| github \| youtube \| reddit \| newsapi \| twitter \| gdelt \| apify_linkedin \| regional_auto |
| source_url | text — RSS URL, subreddit name, channel ID, domain, etc. |
| source_label | text — human-readable name shown in UI |
| keywords | text[] — keyword filter for this source. Only signals matching keywords are stored. |
| is_active | boolean NOT NULL DEFAULT true |
| requires_api_key | boolean NOT NULL DEFAULT false |
| api_key_ref | text — references key_name in org_api_keys table |
| cron_expression | text NOT NULL DEFAULT '0 */6 * * *' — every 6 hours |
| last_scraped_at | timestamptz |
| error_count | integer NOT NULL DEFAULT 0 — auto-incremented on scrape failure |
| auto_activated | boolean NOT NULL DEFAULT false — true = system created, false = user created |
| created_at | timestamptz NOT NULL DEFAULT now() |


### 4.5 org_api_keys

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| key_name | text NOT NULL — reddit_client_id \| reddit_secret \| apify_token \| newsapi_key \| twitter_bearer \| clearbit_key \| youtube_api_key \| tavily_api_key \| brave_search_api_key \| github_token |
| encrypted_value | text NOT NULL — AES-256-GCM encrypted. NEVER stored plaintext. |
| created_at | timestamptz NOT NULL DEFAULT now() |
| updated_at | timestamptz NOT NULL DEFAULT now() |

> **RULE:** All API keys must be AES-256-GCM encrypted using the ENCRYPTION_KEY env var before INSERT. The decrypted value is only ever used inside an Edge Function, never returned to the frontend.
> **RULE:** When plan_tier = 'fully_subscribed', any Edge Function or API endpoint that would create or update a row in org_api_keys must return HTTP 403 {error: 'key_management_disabled_on_fully_subscribed_plan'}. Org users on this plan have no key management UI. Data source adapters resolve keys for fully_subscribed orgs from platform env vars (TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, etc.) set by the operator. If a platform env var is not set for a given source, that source is silently skipped for all fully_subscribed orgs.


### 4.6 signals

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| feed_config_id | uuid REFERENCES feed_configs(id) |
| url_hash | text NOT NULL — SHA-256(url) — deduplication key. UNIQUE per org_id. |
| url | text |
| headline | text NOT NULL |
| summary | text — first 500 chars of article content |
| source_name | text |
| source_type | text |
| published_at | timestamptz |
| scraped_at | timestamptz NOT NULL DEFAULT now() |
| relevance_score | float NOT NULL DEFAULT 0.0 — 0.0 to 1.0, TF-IDF match vs org themes |
| matched_themes | text[] — which of the org's active_themes matched |
| matched_keywords | text[] |
| tags | text[] — auto-extracted topic tags |
| status | text NOT NULL DEFAULT 'unread' — unread \| selected \| dismissed \| archived |
| dismissed_at | timestamptz — set when status = dismissed. NEVER hard delete. |
| dismissed_by | uuid REFERENCES auth.users(id) |
| created_at | timestamptz NOT NULL DEFAULT now() |

> **NOTE:** Dismissed signals must NEVER be hard deleted. Set status='dismissed' and dismissed_at timestamp. Dismissed data is used to improve relevance scoring over time. The trend dashboard hides dismissed signals by default but must have a 'Show dismissed' toggle.


### 4.7 generation_jobs

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| created_by | uuid NOT NULL REFERENCES auth.users(id) |
| signal_id | uuid REFERENCES signals(id) — the trend that triggered this job |
| asset_type | text NOT NULL — image \| video |
| model_id | text NOT NULL — model ID string as used in the provider API call (e.g. 'fal-ai/nano-banana', 'gemini-3-flash-preview'). From available_models table. |
| provider_key | text NOT NULL — matches model_providers.provider_key ('openrouter' \| 'fal' \| 'google_ai_studio' \| 'anthropic' \| 'openai'). Stored with the job so poll-job-status knows which provider to query. |
| content_job_json | jsonb NOT NULL — the complete assembled ContentJob (see Section 6.1) |
| prompt_tags | jsonb NOT NULL — the tag editor fields, shown in non-technical view |
| status | text NOT NULL DEFAULT 'pending' — pending \| processing \| completed \| failed |
| openrouter_job_id | text — async queue job ID from OpenRouter. NULL for OpenRouter image generation, which is synchronous (generate-asset decodes the base64 response and uploads to Storage immediately — no poll needed). Only populated for async OpenRouter video models (e.g. Veo, Kling via OpenRouter) that return a queue job ID. poll-job-status uses this column together with provider_key='openrouter' to know which jobs to poll. |
| output_url | text — Supabase Storage path once asset is saved |
| error_message | text — set on status=failed |
| generation_time_ms | integer — total time from submit to completion |
| poll_count | integer NOT NULL DEFAULT 0 — number of times poll-job-status has checked this job |
| version | integer NOT NULL DEFAULT 1 — increments on each regeneration |
| parent_job_id | uuid REFERENCES generation_jobs(id) — links regenerations to original |
| created_at | timestamptz NOT NULL DEFAULT now() |
| updated_at | timestamptz NOT NULL DEFAULT now() |
| completed_at | timestamptz |


### 4.8 generation_feedback

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| job_id | uuid NOT NULL REFERENCES generation_jobs(id) |
| user_id | uuid NOT NULL REFERENCES auth.users(id) |
| rating | integer — 1 to 5 stars |
| thumbs | text — up \| down |
| note | text — optional free text from user |
| tags_changed | jsonb — which prompt_tags fields were modified before regenerating |
| regenerated | boolean NOT NULL DEFAULT false — did user click regenerate after this feedback |
| created_at | timestamptz NOT NULL DEFAULT now() |


### 4.9 prospects

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| first_name | text |
| last_name | text |
| email | text |
| title | text |
| company_name | text |
| company_domain | text |
| company_size | text |
| industry | text |
| country | text |
| linkedin_url | text |
| enrichment_source | text — pdl \| apollo \| hunter \| clearbit \| web_scrape \| manual |
| enrichment_data | jsonb — raw response from enrichment API, stored for reference |
| company_description | text — short description of the prospect's company. Populated by enrichment sources: PDL company summary, Clearbit company description, or web scrape of the company /about page. Used in ICP score keyword matching (Section 12.3). NULL until at least one enrichment step returns company data. |
| icp_score | float — 0.0 to 1.0, calculated against org ICP criteria |
| status | text NOT NULL DEFAULT 'new' — new \| outreach_drafted \| exported |
| created_at | timestamptz NOT NULL DEFAULT now() |


### 4.10 outreach_copies

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| campaign_id | uuid REFERENCES campaign_briefs(id) ON DELETE SET NULL — NULL for copies generated outside a named campaign |
| prospect_id | uuid NOT NULL REFERENCES prospects(id) |
| job_id | uuid REFERENCES generation_jobs(id) — the approved asset referenced |
| copy_text | text NOT NULL — the personalised outreach message |
| platform | text — which platform this copy is for: 'linkedin_message' \| 'linkedin_post' \| 'email' \| 'cold_dm' \| 'twitter' |
| status | text NOT NULL DEFAULT 'draft' — draft \| approved \| exported |
| approved_by | uuid REFERENCES auth.users(id) — set when status changes to approved |
| approved_at | timestamptz — set when status changes to approved |
| created_at | timestamptz NOT NULL DEFAULT now() |


### 4.11 campaign_briefs

One row per campaign. A campaign is a named, time-bounded content effort tied to a creative asset (job_id) and a set of target prospects.

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| job_id | uuid REFERENCES generation_jobs(id) — the approved creative asset for this campaign. NULL until the user links an asset. |
| name | text NOT NULL — campaign name, e.g. ‘Q3 AI Thought Leadership’. Max 120 chars. |
| status | text NOT NULL DEFAULT 'draft' — draft \| active \| completed \| paused |
| campaign_type | text NOT NULL DEFAULT 'awareness' — awareness \| lead_gen \| nurture \| product_launch |
| description | text — optional internal notes. Max 500 chars. |
| channel_mix | text[] NOT NULL DEFAULT ARRAY['linkedin_message','email'] — which platforms copy should be generated for. Drives multi-channel copy generation. Allowed values: 'linkedin_message' \| 'linkedin_post' \| 'email' \| 'cold_dm' \| 'twitter'. |
| start_date | date — campaign start date. NULL = no fixed date. |
| end_date | date — campaign end date. NULL = no fixed date. |
| brief_data | jsonb — full brief: posting_schedule[], caption_variants{}, hashtag_sets{}, timing_recommendations{}. NULL until generate-campaign-brief has run. |
| pdf_url | text — Supabase Storage path: briefs/{org_id}/{brief_id}.pdf. NULL until brief generated. |
| created_at | timestamptz NOT NULL DEFAULT now() |
| updated_at | timestamptz NOT NULL DEFAULT now() |


### 4.11a campaign_prospects

Junction table linking a campaign to its specific prospect list. Each campaign has its own prospect selection, independent of the global ICP run.

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| campaign_id | uuid NOT NULL REFERENCES campaign_briefs(id) ON DELETE CASCADE |
| prospect_id | uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE |
| added_at | timestamptz NOT NULL DEFAULT now() |

UNIQUE(campaign_id, prospect_id) — a prospect appears at most once per campaign.

RLS: org_isolation on org_id (same pattern as all other tables).


### 4.12 org_model_preferences

One row per org per step_key. Stores the user-selected provider and model for each functional step. Populated and edited via /settings/models. If no row exists for a step_key, the system falls back to the row in available_models where default_for_step_key matches that step_key.
| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| step_key | text NOT NULL — identifies the functional step this preference applies to. Allowed values: 'image_generation' \| 'video_generation' \| 'prompt_assembly' \| 'relevance_scoring' \| 'outreach_copy' \| 'campaign_brief' \| 'brand_embedding'. UNIQUE per org_id. |
| provider_key | text NOT NULL DEFAULT 'google_ai_studio' — matches model_providers.provider_key. Identifies which AI provider handles this step. Determines which org_provider_api_keys row or platform env var is used for the API call. |
| model_id | text NOT NULL — exact model ID string as passed in the provider API call (e.g. 'fal-ai/nano-banana', 'gemini-3-flash-preview', 'claude-sonnet-4-6'). Validated against available_models on save. |
| model_label | text — human-readable name cached from available_models.model_label at time of selection. Display-only; model_id is the authoritative value used in API calls. |
| updated_by | uuid REFERENCES auth.users(id) — last user to change this preference |
| updated_at | timestamptz NOT NULL DEFAULT now() |


### 4.13 model_providers

Stores the available AI provider integrations. Seeded via migration 0005. Operator can toggle providers in Supabase Table Editor without code changes. Changes appear immediately in UI.
| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| provider_key | text NOT NULL UNIQUE — canonical identifier: 'openrouter' \| 'fal' \| 'google_ai_studio' \| 'anthropic' \| 'openai' |
| display_name | text NOT NULL — human-readable name shown in UI (e.g. 'OpenRouter', 'fal.ai', 'Google AI Studio', 'Anthropic', 'OpenAI') |
| api_base_url | text NOT NULL — base URL for API calls to this provider |
| models_endpoint | text — provider endpoint to fetch live model list. Only OpenRouter supports this: https://openrouter.ai/api/v1/models. NULL for all other providers. |
| is_active | boolean NOT NULL DEFAULT true — operator toggle. Inactive providers are hidden from UI immediately without any code change. |
| platform_key_available | boolean NOT NULL DEFAULT false — true if a platform default key is configured for this provider in Edge Function secrets |
| docs_url | text — link to provider documentation shown in settings UI |


### 4.14 available_models

DB-driven model catalog. The operator adds, edits, deactivates, or deletes rows directly in Supabase Table Editor — no code changes required. The frontend reads exclusively from this table via the get-available-models Edge Function. models.config.ts holds only compile-time TypeScript interfaces and the seed data used to populate this table in migration 0005.
| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| provider_key | text NOT NULL — matches model_providers.provider_key |
| model_id | text NOT NULL — exact model ID string as passed in the provider API call (e.g. 'fal-ai/nano-banana', 'gemini-3-flash-preview', 'gpt-5.4') |
| model_label | text NOT NULL — human-readable display name shown in UI |
| model_type | text NOT NULL — 'image' \| 'video' \| 'text' \| 'embedding' |
| output_modalities | text[] — For OpenRouter image models only: ['image','text'] for Gemini image models (which return both image and text in the response), or ['image'] for image-only models (Flux, Sourceful). NULL for all non-OpenRouter models and for video/text/embedding models. openrouter.ts callOpenRouterImage() reads this column from the available_models row and uses it directly as the `modalities` parameter in the API request body. Must be populated in migration 0005 seed data for all OpenRouter image model rows. For live OpenRouter models merged from the API, preserve the output_modalities field from the API response. |
| compatible_step_keys | text[] NOT NULL — step_key values this model can serve. e.g. ARRAY['image_generation'] or ARRAY['prompt_assembly','relevance_scoring','outreach_copy','campaign_brief'] |
| description | text — one to two sentences shown in model picker and settings page |
| is_active | boolean NOT NULL DEFAULT true — set false to hide from all UI without deleting the row |
| default_for_step_key | text — if this is the system default for a step, set to that step_key value. NULL otherwise. Only one row per step_key should be non-null. Operator controls in Table Editor. No code change needed to change the default. |
| is_recommended | boolean NOT NULL DEFAULT false — if true, model appears in the Recommended section at top of model selector |
| recommendation_text | text — operator-authored blurb shown in the recommendations carousel. Update directly in Table Editor; changes appear in UI immediately. Max 280 chars. |
| recommendation_order | integer — display order within recommendations section (lower = shown first) |
| key_source | text NOT NULL DEFAULT 'user_or_platform' — 'platform' \| 'user_or_platform' \| 'user_required'. Controls API key resolution: 'platform' = always use platform env var for this provider; 'user_or_platform' = use org key if present else platform env var; 'user_required' = HTTP 403 if org has no key for this provider. |
| requires_paid_plan | boolean NOT NULL DEFAULT false — if true, locked for starter plan orgs |
| estimated_time_seconds | integer — displayed as estimated generation time in UI |
| context_length | integer — for text/embedding models, max token context |
| cost_tier | text — 'free' \| 'cheap' \| 'mid' \| 'premium' — badge shown in model picker |
| release_date | text — human-readable release date shown in recommendations (e.g. 'Released Feb 26, 2026') |
| cost_per_1k_input_tokens | numeric(10,8) — optional. Operator-set cost in USD per 1,000 input tokens. Used to estimate cost in llm_usage_events. NULL for image/video models or when not tracked. |
| cost_per_1k_output_tokens | numeric(10,8) — optional. Operator-set cost in USD per 1,000 output tokens. NULL for non-text models or when not tracked. |
| created_at | timestamptz NOT NULL DEFAULT now() |
| updated_at | timestamptz NOT NULL DEFAULT now() |
UNIQUE (provider_key, model_id)

> **NOTE:** Adding a new model requires only an INSERT into available_models (and into model_providers if using a new provider). No code change is required. Setting is_active=false immediately removes the model from all UI selectors. Changing default_for_step_key immediately updates the system default shown to users.


### 4.15 org_provider_api_keys

Each org's API key per AI provider. Separate from org_api_keys (which stores keys for data source integrations like Reddit, YouTube, NewsAPI). All keys must be AES-256-GCM encrypted before storage.
| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| provider_key | text NOT NULL — matches model_providers.provider_key: 'openrouter' \| 'fal' \| 'google_ai_studio' \| 'anthropic' \| 'openai' |
| encrypted_key | text NOT NULL — AES-256-GCM encrypted API key using ENCRYPTION_KEY env var. Never stored plaintext. Never returned in any response. |
| key_label | text — optional user-provided label (e.g. 'Company OpenRouter key') |
| created_at | timestamptz NOT NULL DEFAULT now() |
| updated_at | timestamptz NOT NULL DEFAULT now() |
UNIQUE (org_id, provider_key)

> **RULE:** All keys in org_provider_api_keys must be AES-256-GCM encrypted using the ENCRYPTION_KEY env var before every INSERT or UPDATE. The decrypted value is used only inside Edge Functions and is never returned in any API response.
> **RULE:** When the org's plan_tier is 'fully_subscribed', the save-provider-keys Edge Function must return HTTP 403 {error: 'api_key_management_disabled_on_fully_subscribed_plan'}. On this plan, platform keys are provided exclusively and users cannot supply their own provider keys.


### 4.16 RLS policy pattern

Apply this exact pattern to every table that has an org_id column. Create all policies in migration 0002_rls_policies.sql.

```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- SELECT: users can only see their own org's rows
CREATE POLICY "org_isolation_select" ON <table_name>
  FOR SELECT USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- INSERT: org_id must match JWT claim
CREATE POLICY "org_isolation_insert" ON <table_name>
  FOR INSERT WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- UPDATE: can only update own org's rows
CREATE POLICY "org_isolation_update" ON <table_name>
  FOR UPDATE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- DELETE: can only delete own org's rows (applies where client-side deletes are permitted)
CREATE POLICY "org_isolation_delete" ON <table_name>
  FOR DELETE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
```

> **NOTE:** Edge Functions that delete rows (delete-data-source-key, delete-provider-key, remove-member) use the Supabase service role client, which bypasses RLS entirely. The DELETE policy above is needed for any future direct-client DELETE operations and for completeness. Apply it in migration 0002 to all org-scoped tables.
> **RULE:** RLS policies must be created in migration 0002 — not added later, not skipped for convenience. After applying migrations, test every policy by attempting a cross-org SELECT as a test user — it must return zero rows. Ship nothing until this test passes.


### 4.17 llm_usage_events

One row per LLM or AI provider API call. Written by every provider adapter via _shared/observability.ts after each call completes (success or failure). Used for per-org usage reporting on /settings/usage and operator-level cost visibility. RLS applied: orgs can only read their own rows. Operator reads all rows via service role.

| Column | Type / Notes |
| --- | --- |
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE |
| provider_key | text NOT NULL — 'openrouter' \| 'fal' \| 'google_ai_studio' \| 'anthropic' \| 'openai' |
| model_id | text NOT NULL — exact model ID as called |
| step_key | text — pipeline step that triggered this call: 'image_generation' \| 'video_generation' \| 'prompt_assembly' \| 'relevance_scoring' \| 'outreach_copy' \| 'campaign_brief' \| 'brand_embedding'. NULL for ad-hoc calls. |
| job_id | uuid REFERENCES generation_jobs(id) — set when the call belongs to a generation job. NULL for text/embedding steps. |
| key_source_used | text NOT NULL — 'platform' if platform env var key was used; 'user' if the org’s own provider key was used. |
| prompt_tokens | integer — input tokens consumed. NULL for image/video models. |
| completion_tokens | integer — output tokens generated. NULL for image/video models. |
| total_tokens | integer — prompt_tokens + completion_tokens. NULL for image/video models. |
| estimated_cost_usd | numeric(10,6) — calculated from available_models cost columns if set. NULL if cost data unavailable for this model. |
| latency_ms | integer — wall-clock milliseconds from request sent to response received. |
| success | boolean NOT NULL — true if call completed without error. |
| error_code | text — provider error code if success=false. NULL on success. |
| called_at | timestamptz NOT NULL DEFAULT now() |

> **RULE:** Every provider adapter (openrouter.ts, fal.ts, google_ai_studio.ts, anthropic.ts, openai.ts) must call recordUsage() from _shared/observability.ts after every API call — on both success and failure. A failed recordUsage write must never cause the main call to fail — wrap in try/catch and log to Sentry silently.
> **NOTE:** For image and video models, prompt_tokens, completion_tokens, and total_tokens are always NULL. estimated_cost_usd for image/video may be populated if the provider response includes per-generation cost metadata.


### 4.18 Supabase Storage Buckets

Define all three buckets in migration 0006. Apply bucket RLS policies in that same migration using the Supabase Storage RLS pattern (`storage.objects` table policies).

| Bucket name | Access | Path pattern | Max file size | Notes |
| --- | --- | --- | --- | --- |
| brands | Private | brands/{org_id}/{filename} | Logo 5MB, guidelines PDF 20MB, ref images 10MB each | Brand logos, guidelines PDF, reference images, anti-reference images. Readable only by authenticated users in the same org (SELECT policy: auth.uid() in org_members for that org_id). Writable only via service role inside Edge Functions. |
| assets | Private | assets/{org_id}/{job_id}.{ext} | Images 10MB, videos 500MB | Generated images (.png) and videos (.mp4). Written by poll-job-status via service role. Readable by authenticated users in the same org. Access via signed URL (1-hour expiry) generated in Edge Functions — never return a permanent public URL. |
| briefs | Private | briefs/{org_id}/{brief_id}.pdf | 5MB | Campaign brief PDFs. Written by generate-campaign-brief via service role. Readable by authenticated users in the same org. Access via signed URL (1-hour expiry). |

> **RULE:** Never set any bucket to public. All file access must go through signed URLs generated inside Edge Functions using the service role client. Signed URLs expire in 1 hour. Never return a permanent storage URL in any API response.
> **RULE:** Enforce per-org path isolation in storage by always using `{org_id}` as the first path segment in every upload. RLS policy on `storage.objects`: `(storage.foldername(name))[1] = (SELECT org_id::text FROM org_members WHERE user_id = auth.uid() LIMIT 1)`. Apply this policy to SELECT operations on all three buckets. INSERT/UPDATE/DELETE are service-role-only.


---

## 5. Supabase Edge Functions

All Edge Functions live at /supabase/functions/<name>/index.ts. Written in Deno/TypeScript. Shared utilities live in /supabase/functions/_shared/.

> **RULE:** Every Edge Function must: (1) extract JWT from Authorization header and verify it, (2) get org_id from JWT claims only, (3) validate org_id is a valid UUID, (4) never expose stack traces in error responses, (5) return JSON with standard HTTP status codes.
> **EXCEPTION — Cron-triggered functions:** ingest-signals, poll-job-status, reset-monthly-quotas, and archive-old-signals are called by pg_cron with the SUPABASE_SERVICE_ROLE_KEY in the Authorization header, NOT a user JWT. These functions must detect that the caller is the service role (not a user) and operate across ALL orgs rather than a single org. Check for service role by verifying the Authorization header matches the expected service key, then query all orgs directly via the service client. Do NOT apply the requireRole(jwt, minRole) check in cron-triggered functions.
> **EXCEPTION — dodopayments-webhook:** This is a public endpoint. It does NOT receive a user JWT. Instead it verifies the Dodo Payments HMAC signature using DODO_WEBHOOK_SECRET. Do NOT apply JWT auth or requireRole in this function — it will reject all webhook calls. The HMAC check IS the authentication mechanism for this function.

| Function | Purpose and trigger |
| --- | --- |
| ingest-signals | Triggered by Supabase Cron every 15 min. Reads active feed_configs per org, calls each source adapter, normalises to Signal schema, deduplicates by url_hash, scores relevance against org themes using TF-IDF, writes new signals to signals table. |
| build-prompt | HTTP POST. Takes signal_id + prompt_tags JSON. Looks up brand_contexts via pgvector semantic search. Assembles full ContentJob JSON. Returns ContentJob. Does NOT call OpenRouter. |
| generate-asset | HTTP POST. Takes ContentJob JSON + optional {model_id, provider_key}. If omitted, reads org’s saved preference from org_model_preferences for step_key ‘image_generation’ or ‘video_generation’, falling back to the available_models system default. Calls check-quota (rejects with 402 if over limit). Resolves API key via _shared/providers/router.ts resolveApiKey(orgId, providerKey): (1) look up org_provider_api_keys for this provider_key — decrypt if present; (2) if model.key_source = ‘user_required’ and no org key — return HTTP 403 {error: ‘This model requires your own [Provider] API key. Add it in Settings → Model Settings.’}; (3) if model.key_source = ‘user_or_platform’ — use org key if present, else platform env var for that provider; (4) if model.key_source = ‘platform’ — always use platform env var. Dispatches to correct provider adapter via routeGeneration(). Increments image_used or video_used. Writes generation_jobs row (status=pending, provider_key stored). For fast image models (estimated_time_seconds < 30): waits synchronously. For video and slow models: returns job_id immediately. Never blocks HTTP response for more than 30s. |
| poll-job-status | Triggered by Supabase Cron every 30s. Queries all generation_jobs WHERE status IN ('pending','processing'). Uses the job's stored provider_key to call the correct provider's status/polling endpoint via _shared/providers/router.ts. On completion: downloads asset, saves to Supabase Storage at assets/{org_id}/{job_id}.{ext}, updates output_url + status + completed_at + generation_time_ms. Fires Supabase Realtime broadcast on channel 'job:{job_id}'. Sends Resend email if asset_type = video. |
| check-quota | HTTP GET. Returns {image_quota, image_used, video_quota, video_used, plan_tier} for the requesting org. Frontend calls this before showing generate button. |
| icp-enrich | HTTP POST. Takes ICP criteria {industries, company_sizes, geographies, titles, domains[]}. Saves criteria to brand_contexts.last_icp_criteria for the requesting org. Resolves enrichment API keys from platform env vars: PDL_API_KEY (Step 1), APOLLO_API_KEY (Step 2), HUNTER_API_KEY (Step 3), CLEARBIT_API_KEY (Step 4). These are operator-level platform keys — not per-org. If a platform env var is not set, that waterfall step is silently skipped and enrichment continues with the next step. Step 5 (web scrape) requires no key. After enrichment, computes icp_score per Section 12.3 and writes to prospects table. Returns enriched prospect list. |
| personalise | HTTP POST. Takes prospect_id + job_id. Retrieves brand_contexts + prospect data + approved asset metadata. Resolves text model via org_model_preferences for step_key 'outreach_copy' (falls back to available_models default). Calls the resolved provider via _shared/providers/router.ts. Writes to outreach_copies. Returns copy_text. |
| generate-campaign-brief | HTTP POST. Takes campaign_id (required) and optional override {job_id, prospect_ids[], channel_mix[]}. If campaign_id is supplied and campaign_prospects rows exist, uses those as the prospect list (ignoring prospect_ids[]). channel_mix from campaign_briefs.channel_mix unless overridden. Generates: 14-day content posting schedule (one entry per posting day per channel), caption variants per channel (primary + 2 alternatives), hashtag sets (general + industry-specific + regional), best-time-to-post table using org timezone. For each channel in channel_mix, generates outreach copy for each prospect (writes outreach_copies rows with campaign_id set). Resolves text model via org_model_preferences for step_key 'campaign_brief'. Generates PDF via @react-pdf/renderer containing: campaign summary, posting schedule grid, per-channel caption variants, prospect copy table, hashtag sets. Stores at briefs/{org_id}/{brief_id}.pdf. Updates campaign_briefs.brief_data, campaign_briefs.pdf_url, campaign_briefs.updated_at. Returns {brief_id, pdf_url, copy_count, channel_summary}. |
| create-campaign | HTTP POST — admin/owner or member. Accepts {name, campaign_type, description?, channel_mix?, start_date?, end_date?, job_id?}. Validates name (non-empty, max 120 chars), campaign_type (allowed enum), channel_mix values (allowed enum array). INSERTs into campaign_briefs with status='draft'. Returns {campaign_id}. |
| add-campaign-prospects | HTTP POST — admin/owner or member. Accepts {campaign_id, prospect_ids[]}. Validates campaign_id belongs to requesting org. Bulk-inserts into campaign_prospects (INSERT ... ON CONFLICT DO NOTHING). Returns {added: int, skipped: int}. |
| update-campaign | HTTP PATCH — admin/owner or member. Accepts {campaign_id, ...fields}. Allowed updatable fields: name, status, campaign_type, description, channel_mix, start_date, end_date, job_id. Validates campaign belongs to org. Updates campaign_briefs row. Returns {updated: true}. |
| dodopayments-webhook | HTTP POST — public endpoint. Verifies Dodo Payments webhook signature (HMAC). On subscription.created or subscription.updated: updates orgs.plan_tier, seat_limit, image_quota, video_quota. On subscription.cancelled: downgrades to starter. On invoice.paid: resets image_used=0, video_used=0, sets quota_reset_at to next billing date. |
| invite-user | HTTP POST — owner/admin only. Checks current org_members count < orgs.seat_limit. Calls supabase.auth.admin.inviteUserByEmail(). Creates pending org_members row. Returns invite status. |
| get-available-models | HTTP GET. Returns all models from available_models table (is_active=true), grouped by provider_key and model_type. For the OpenRouter provider: if the org has an openrouter key in org_provider_api_keys, additionally calls https://openrouter.ai/api/v1/models and merges live results (DB records take priority; any live OpenRouter model not in DB is also included for completeness). For all other providers: returns only DB-curated rows. Response includes: (1) all provider groups with their models, (2) recommended models section (is_recommended=true, ordered by recommendation_order, includes recommendation_text for display), (3) org's current saved preferences from org_model_preferences, (4) each provider's key status (org key present: yes/no, platform key available: yes/no). Response cached in memory 10 minutes per org. Frontend /settings/models and /create pages call this to populate all model selectors and the recommendations carousel. Returns {providers: ProviderGroup[], recommended: RecommendedModel[], preferences: OrgPreference[], cached_at: timestamp}. |
| save-model-preferences | HTTP POST — admin/owner only. Accepts {preferences: [{step_key, provider_key, model_id, model_label}]}. Validates each (provider_key, model_id) pair exists in available_models with is_active=true. Validates the model's compatible_step_keys includes the given step_key. On success: upserts rows in org_model_preferences (INSERT ... ON CONFLICT (org_id, step_key) DO UPDATE). Returns {saved: step_key[], errors: [{step_key, reason}]}. |
| save-provider-keys | HTTP POST — admin/owner only. Accepts {provider_key: string, api_key: string, key_label?: string}. Validates provider_key exists in model_providers with is_active=true. Encrypts api_key with AES-256-GCM using ENCRYPTION_KEY. Upserts into org_provider_api_keys (INSERT ... ON CONFLICT (org_id, provider_key) DO UPDATE). Returns {saved: true, provider_key}. The raw key is never returned in any response. If org plan_tier = 'fully_subscribed': returns HTTP 403 {error: 'api_key_management_disabled_on_fully_subscribed_plan'}. |
| delete-provider-key | HTTP DELETE — admin/owner only. Accepts {provider_key}. Deletes the org_provider_api_keys row for org_id + provider_key. After deletion, generation falls back to the platform default key (if platform_key_available=true for that provider) or rejects with HTTP 403 for user_required models. Returns {deleted: true, provider_key}. |
| get-usage-stats | HTTP GET — admin/owner only. Returns aggregated token and cost data from llm_usage_events for the requesting org. Query param: period=day\|week\|month\|all (default: month). Returns {period, by_model: [{provider_key, model_id, step_key, total_calls, prompt_tokens, completion_tokens, estimated_cost_usd, key_source_used}], totals: {total_calls, total_tokens, estimated_cost_usd}, key_source_split: {platform: {calls, cost_usd}, user: {calls, cost_usd}}}. Reads only from llm_usage_events — no external API calls. |
| create-org | HTTP POST — authenticated user with no org_members row yet. Accepts {name: string, slug: string}. Validates: slug is URL-safe (a-z0-9-), 3–30 chars, unique across orgs. INSERTs into orgs (plan_tier=starter, seat_limit=2, image_quota=50, video_quota=5, image_used=0, video_used=0, signal_ingestion_enabled=false, onboarding_complete=false). INSERTs into org_members (role=owner, status='active'). Calls supabase.auth.admin.updateUserById to set app_metadata.org_id. Returns {org_id, slug}. Idempotent: if user already has an org_members row, returns HTTP 409. |
| save-onboarding | HTTP POST — any authenticated org member. Accepts the full brand_contexts payload from any onboarding section. UPSERTs one brand_contexts row per org. Accepts a `complete` boolean flag. When complete=true: sets orgs.onboarding_complete=true; extracts text from the guidelines PDF (if uploaded) using pdfjs-dist via `npm:pdfjs-dist` and stores result in brand_contexts.brand_guidelines_text (null if extraction fails — never reject the save); generates a brand context embedding by concatenating company_name + one_sentence_pitch + extended_description + products_services names + active_themes + decision_maker_titles, calling the configured embedding model (default: perplexity/pplx-embed-v1-0.6b via OpenRouter), and storing the result in brand_contexts.brand_context_embedding. Embedding failure must be caught silently — never block the save. Returns {saved: true, onboarding_complete: boolean}. |
| update-org-settings | HTTP POST — admin/owner only. Accepts any subset of: {signal_ingestion_enabled?: boolean, signal_ingestion_frequency?: string}. Validates signal_ingestion_frequency against the allowed enum values. Updates the orgs row. If signal_ingestion_enabled is set to true and orgs.last_signal_ingestion_at is null: immediately calls ingest-signals (HTTP POST) for this org so signals appear without waiting for the next cron tick. Returns {updated: true, triggered_immediate_ingest: boolean}. |
| save-data-source-key | HTTP POST — admin/owner only. Returns HTTP 403 if plan_tier = fully_subscribed. Accepts {key_name: string, value: string}. Validates key_name is one of the allowed values in org_api_keys.key_name. Encrypts value with AES-256-GCM using ENCRYPTION_KEY from env. UPSERTs into org_api_keys. Returns {saved: true, key_name}. Raw value is never returned in any response. |
| delete-data-source-key | HTTP DELETE — admin/owner only. Returns HTTP 403 if plan_tier = fully_subscribed. Accepts {key_name: string}. Deletes the org_api_keys row for org_id + key_name. Sets is_active=false on any feed_config rows whose api_key_ref matches this key_name. Returns {deleted: true, key_name}. |
| remove-member | HTTP POST — owner or admin. Admin cannot remove or demote owner. Accepts {user_id: string, action: "remove" \| "change_role", new_role?: "admin" \| "member"}. For action="remove": validates that at least one owner remains after removal, then deletes the org_members row. For action="change_role": only owner can perform this; updates org_members.role. Returns {success: true}. |
| submit-feedback | HTTP POST — any authenticated org member. Accepts {job_id: string, rating?: integer 1–5, thumbs?: "up" \| "down", note?: string, tags_changed?: jsonb, regenerated?: boolean}. At least one of rating or thumbs must be provided. INSERTs into generation_feedback. Returns {saved: true, feedback_id}. |
| get-upload-url | HTTP POST — any authenticated org member. Accepts {bucket: "brands", path: string, content_type: string}. Validates: bucket must be "brands" (users cannot upload to assets or briefs — those are written by Edge Functions only). path must start with {org_id}/ (enforced by the function, not taken from request body). Builds the full path: {org_id}/{requested_filename}. Validates content_type is one of: image/png, image/jpeg, image/svg+xml, application/pdf, image/webp. Calls supabase.storage.from("brands").createSignedUploadUrl(fullPath) using the service role client. Returns {signed_url: string, path: string, token: string}. The frontend uses this signed URL to PUT the file bytes directly to Supabase Storage (one HTTP call from browser to Storage, no Edge Function proxy). After the upload completes, the frontend calls save-onboarding with the file path (not the file bytes). Signed upload URL expires in 60 seconds. |
| accept-invite | HTTP POST — authenticated user who just confirmed their Supabase Auth invite link. No request body required — org_id is resolved from the pending org_members row for this user_id. Looks up org_members WHERE user_id = auth_user_id AND status = 'pending'. If found: updates status to 'active', calls supabase.auth.admin.updateUserById to set app_metadata.org_id so the JWT claim is active on next token refresh, returns {success: true, org_id, onboarding_complete}. If no pending row found: HTTP 404 {error: "no_pending_invite"}. |
| operator-admin | HTTP POST — operator-only. Auth: `Authorization: Bearer <OPERATOR_SECRET>` env var — NOT a user JWT. No CORS restriction (called by operator tooling and Supabase dashboard, not the browser UI). Uses service role client for all DB operations — bypasses RLS entirely. Accepts `{action: string, payload: object}`. Actions: `update_org` → updates any field on the orgs row (plan_tier, seat_limit, image_quota, video_quota, signal_ingestion_enabled, etc.) for a given org_id; `reset_org_usage` → sets image_used=0, video_used=0 for the org; `delete_member` → removes org_members row by (org_id + user_id) and optionally calls supabase.auth.admin.deleteUser if `delete_auth_user: true` is passed; `change_member_role` → updates org_members.role; `toggle_source` → sets feed_configs.is_active for a given feed_config_id; `upsert_model` → INSERT … ON CONFLICT DO UPDATE on available_models using any supplied columns (zero code change equivalent for operators who prefer an API over Table Editor); `create_campaign_job` → creates a generation_jobs row for any org_id using service-role context (bypasses quota checks for operator-initiated jobs), calls build-prompt and generate-asset on behalf of the client org by passing the org_id in the function body (service role bypasses org isolation so the call acts as that org). Returns {success: true, result: object} on success. Returns HTTP 401 if OPERATOR_SECRET header does not match. Returns HTTP 400 with {error, details} on invalid action or missing payload fields. Never expose stack traces. Log all operator actions to a dedicated `operator_audit_log` table (org_id, action, changed_by: 'operator', payload_summary: text, created_at). |


> **WARNING (`pdfjs-dist` in Deno):** save-onboarding uses pdfjs-dist (`npm:pdfjs-dist`) to extract text from brand guidelines PDFs. pdfjs-dist was designed for browser and Node.js environments. In Deno, import via `npm:pdfjs-dist/legacy/build/pdf.js` (the legacy build avoids worker/canvas dependencies). Set GlobalWorkerOptions.workerSrc to an empty string or use the no-worker mode. Test with a real PDF in the local Supabase CLI environment before deploying. If extraction fails (returns empty string or throws), set brand_guidelines_text = null and continue — never reject the save. Consider `pdf-parse` (`npm:pdf-parse`) as a simpler alternative if pdfjs-dist proves incompatible with the Deno runtime.
> **WARNING (`@react-pdf/renderer` in Deno):** generate-campaign-brief uses @react-pdf/renderer to produce campaign brief PDFs. This library targets Node.js and browser environments. In Supabase Edge Functions (Deno), import it via `npm:@react-pdf/renderer`. Test PDF generation against the Deno runtime in a local Supabase CLI environment as part of Week 5. If Deno compatibility issues arise, fall back to `pdf-lib` (Deno-native, import from `npm:pdf-lib`) and render a simpler non-React PDF layout with the same content sections.


### 5.1 Shared utilities in _shared/

| File | Contents |
| --- | --- |
| schemas.ts | Zod schemas for all shared types. Exports: `ContentJobSchema`, `PromptTagsSchema`, and per-function request body schemas (`CreateOrgBodySchema`, `SaveOnboardingBodySchema`, `GenerateAssetBodySchema`, etc.). All Edge Functions import from here — never define inline Zod schemas in function files. Also exports inferred TypeScript types: `type ContentJob = z.infer<typeof ContentJobSchema>`. |
| auth.ts | validateJWT(req), extractOrgId(jwt), requireRole(jwt, minRole) |
| db.ts | createSupabaseClient(serviceRoleKey) — returns typed Supabase client |
| encryption.ts | encrypt(plaintext, key): string, decrypt(ciphertext, key): string — AES-256-GCM |
| relevance.ts | scoreRelevance(headline, summary, themes, keywords): float — TF-IDF implementation |
| observability.ts | recordUsage(supabase, langfuse, event): Promise<void> — called by all non-OpenRouter provider adapters after every API response (success or failure). Does two things in parallel: (1) INSERTs one row into llm_usage_events for DB-native usage tracking; (2) sends a Langfuse SDK generation trace tagged with userId: orgId, sessionId: jobId, and metadata {org_id, org_slug, step_key, provider_key, key_source_used} so all providers appear in Langfuse alongside OpenRouter Broadcast traces. Calculates estimated_cost_usd from available_models cost columns if set. Both tracks are fire-and-forget — each wrapped in try/catch, failures logged to Sentry, never thrown. |
| providers/router.ts | routeGeneration(providerKey, modelId, payload, apiKey): Promise<ProviderResponse> — dispatches to correct provider adapter based on provider_key. Also exports resolveApiKey(orgId, providerKey): Promise<string> — reads org_provider_api_keys (decrypts), falls back to platform env var if key_source allows, throws HTTP 403 if key_source='user_required' and no org key found. |
| providers/openrouter.ts | Two distinct call functions — keep them separate:

**callOpenRouter(modelId, prompt, opts, apiKey, orgSlug)** — text generation (prompt_assembly, relevance_scoring, outreach_copy, campaign_brief, brand_embedding). Returns the response text from choices[0].message.content.

**callOpenRouterImage(modelId, compiledPrompt, imageConfig, modalities, apiKey, orgSlug, orgId, jobId)** — image generation ONLY. Key differences from callOpenRouter: (1) adds `modalities` to the request body — value comes from available_models.output_modalities for the selected model (['image','text'] for Gemini, ['image'] for Flux/Sourceful); (2) optionally adds `image_config: {aspect_ratio, image_size}` mapped from ContentJob.prompt_tags.aspect_ratio; (3) response is parsed from choices[0].message.images[0].image_url.url (base64 data URL), NOT from message.content — if images array is empty, throws 'openrouter_image_no_output'; (4) decodes base64 to Uint8Array and uploads to Storage (assets/{orgId}/{jobId}.png) using service role client; (5) returns {bytes: Uint8Array, outputUrl: string}. OpenRouter image generation is always synchronous — no polling. openrouter_job_id is null for all image jobs.

**pollOpenRouterJob(jobId, apiKey)** — polls async video jobs only (openrouter_job_id is set).

**fetchOpenRouterModelList(apiKey)** — fetches all live models. Filter .filter(m => m.output_modalities?.includes('image')) client-side in get-available-models to get image-capable models (no extra HTTP call needed).

Every call (both text and image) must include user: orgId, session_id: jobId, and trace: {org_id, org_slug, step_key, job_id} in the API request body so OpenRouter Broadcast forwards these fields to Langfuse automatically for per-client filtering. org_slug is NOT in the JWT — query SELECT slug FROM orgs WHERE id = $org_id LIMIT 1 once per job run and pass as orgSlug. Cache the slug for the duration of a single job run. openrouter.ts does NOT call recordUsage() — OpenRouter Broadcast handles all traces. |
| providers/fal.ts | callFal(modelId, payload, apiKey), pollFalJob(requestId, apiKey).

**All fal.ai models return a hosted URL, NOT base64.** Response: `result.data.images[0].url` (e.g. `https://v3.fal.media/files/...`). callFal must fetch() this URL, read the bytes as ArrayBuffer, then upload to Supabase Storage (`assets/{orgId}/{jobId}.png`). Never store the fal.media URL directly — it is ephemeral and expires.

**Input schema varies by model** — callFal must build the input object from ContentJob based on the model_id:

- `fal-ai/nano-banana-2`: `{prompt, aspect_ratio, resolution, num_images, output_format, seed}`. `aspect_ratio` accepts the string from ContentJob.prompt_tags.aspect_ratio directly (or "auto"). `resolution` default "1K", use "2K" for better quality.
- `fal-ai/nano-banana`: `{prompt, aspect_ratio, num_images, output_format, seed}`. `aspect_ratio` enum: `21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16`. No `resolution` param. Map "4:5"→"4:5" directly.
- `fal-ai/bytedance/seedream/v4/text-to-image`: `{prompt, image_size, num_images, seed, enhance_prompt_mode}`. No `aspect_ratio` param — use `image_size` named enum: `1:1`→`square_hd`, `16:9`→`landscape_16_9`, `9:16`→`portrait_16_9`, `4:5`→`portrait_4_3`.
- `fal-ai/qwen-image`: `{prompt, image_size, num_images, seed, negative_prompt, output_format, use_turbo}`. Same `image_size` mapping as Seedream. Has native `negative_prompt` field — pass ContentJob.compiled_negative here directly (do not embed in prompt string). Set `use_turbo: true` for faster generation.
- `fal-ai/flux-pro/kontext/max/text-to-image`: `{prompt, aspect_ratio, guidance_scale, num_images, output_format, seed, enhance_prompt}`. `aspect_ratio` enum: `21:9, 16:9, 4:3, 3:2, 1:1, 2:3, 3:4, 9:16, 9:21`. `output_format` default is `jpeg` — always pass `output_format: "png"` to match Storage upload contentType. `guidance_scale` default 3.5, `enhance_prompt: true` recommended.

For all models: embed `compiled_negative` inline in the prompt string as `\n\nNegative: {compiled_negative}` EXCEPT for `fal-ai/qwen-image` which has a native `negative_prompt` field. |
| providers/google_ai_studio.ts | callGoogleAIStudio(modelId, payload, apiKey) — handles both image (gemini image models) and video (veo models) and text (gemini text models) via the Gemini REST API |
| providers/anthropic.ts | callAnthropic(modelId, messages, apiKey) — Anthropic Messages API wrapper |
| providers/openai.ts | callOpenAI(modelId, messages, apiKey), embedText(text, modelId, apiKey) — OpenAI Chat and Embeddings API wrapper |
| sources/rss.ts | fetchRSSFeed(url): Signal[] |
| sources/hackernews.ts | fetchHackerNews(keywords): Signal[] |
| sources/producthunt.ts | fetchProductHunt(keywords): Signal[] |
| sources/github.ts | fetchGitHub(orgName, token?): Signal[] |
| sources/youtube.ts | fetchYouTube(channelId, apiKey): Signal[] |
| sources/reddit.ts | fetchReddit(subreddit, keywords, clientId, secret): Signal[] |
| sources/newsapi.ts | fetchNewsAPI(keywords, apiKey): Signal[] |
| sources/twitter.ts | fetchTwitter(query, bearerToken): Signal[] |
| sources/gdelt.ts | fetchGDELT(keywords): Signal[] |
| sources/apify_linkedin.ts | fetchLinkedIn(profileUrl, apifyToken): Signal[] — with 24h TTL enforcement |
| sources/tavily.ts | fetchTavily(query, apiKey): Signal[] — web search via Tavily AI Search API. Runs per active_theme and per competitor_name. Returns up to 10 ranked results per query. |
| sources/brave_search.ts | fetchBraveSearch(query, apiKey): Signal[] — web search via Brave Search API. Runs per active_theme and per competitor_name. Returns up to 20 ranked results per query. |
| sources/regional.ts | getRegionalSources(countryCode): FeedConfig[] — returns auto-activated source list |
| enrichment/pdl.ts | enrichPDL(criteria, apiKey): Prospect[] |
| enrichment/apollo.ts | enrichApollo(criteria, apiKey): Prospect[] |
| enrichment/hunter.ts | enrichHunter(domain, apiKey): {email} |
| enrichment/clearbit.ts | enrichClearbit(domain, apiKey): CompanyData |
| enrichment/web_scrape.ts | scrapePublicProfile(url): Partial<Prospect> |


---

## 6. ContentJob JSON Structure

This is the structured prompt object assembled by build-prompt and passed to generate-asset. It is the single source of truth for what gets generated. It is stored in generation_jobs.content_job_json.

```json
{
  job_id:                  string,           // generation_jobs.id
  org_id:                  string,           // from JWT
  org_slug:                string,           // from orgs.slug — queried by build-prompt using org_id. Used in download filenames ({org_slug}_{date}_{job_id_short}.ext) and OpenRouter trace metadata.
  asset_type:              'image' | 'video',
  provider_key:            string,           // provider_key from available_models (e.g. 'openrouter' | 'fal' | 'google_ai_studio' | 'anthropic' | 'openai')
  model_id:                string,           // exact model ID from available_models
  prompt_tags: {
    subject:               string,           // main subject — required
    visual_style:          string,           // photography|illustration|abstract|3d|flat
    mood:                  string,           // professional|bold|calm|energetic|minimal|etc
    colour_palette:        string,           // assembled from brand_colours + overrides
    platform:              string,           // linkedin|instagram|twitter|generic
    aspect_ratio:          string,           // 1:1 | 16:9 | 9:16 | 4:5
    cta_text:              string,           // optional overlay or caption text
    negative_prompt:       string,           // auto-built from avoidance fields + user additions
    additional_notes:      string,           // free text from user
  },
  brand_context_summary:   string,           // assembled by build-prompt from the org's brand_context row (one row per org). build-prompt concatenates: one_sentence_pitch + extended_description + active_themes + decision_maker_titles + brand_guidelines_text (if not null). The pgvector embedding on brand_contexts is used for future multi-org or multi-document retrieval — in v1 with one brand_context per org it is not used for a similarity search. build-prompt does a simple SELECT WHERE org_id = $1 to fetch the brand context row.
  voice_examples:          string[],         // up to 3 from brand_contexts.voice_examples
  competitor_names:        string[],         // injected as negative context
  signal_headline:         string,           // the trend headline that triggered this
  signal_summary:          string,           // the trend summary
  compiled_prompt:         string,           // final assembled prompt string sent to model
  compiled_negative:       string,           // final assembled negative prompt string
}
```

> **NOTE:** prompt_tags is what non-technical users see and edit in the tag editor form. compiled_prompt is assembled from all fields by the build-prompt function and sent to the model. Users never edit compiled_prompt directly. The JSON toggle in the UI shows the full ContentJob for technical users.

> **RULE — Zod validation for ContentJob:** `build-prompt` asks the LLM to return a JSON object. The raw response MUST be parsed with `ContentJobSchema.parse(JSON.parse(text))` before being stored in `generation_jobs.content_job_json`. If parsing fails, the function returns HTTP 422 `{error: "llm_output_invalid", details: zodError.flatten()}`. Never store an unvalidated LLM response in the DB.

> **RULE — Structured outputs per provider:** When calling an LLM to get JSON back (build-prompt step), always pass the JSON schema to the provider so the model is constrained server-side AND validate the response with Zod as a backstop:
> - **OpenRouter / OpenAI:** add `response_format: { type: "json_schema", json_schema: { name: "ContentJob", strict: true, schema: ContentJobJsonSchema } }` to the request body.
> - **Google AI Studio (Gemini):** add `generationConfig: { responseMimeType: "application/json", responseSchema: ContentJobGeminiSchema }` to the request body.
> - **Anthropic:** add `"anthropic-beta": "json-schema-2025-05-01"` header and `response_format: { type: "json", json_schema: ContentJobJsonSchema }` to the request body.
> - `ContentJobJsonSchema` (JSON Schema object) and `ContentJobGeminiSchema` are exported from `_shared/schemas.ts` alongside the Zod schema.


---

## 7. AI Models Configuration

All system default model definitions are seeded into the available_models table in migration 0005_model_seed.sql. The file apps/web/lib/models.config.ts holds only TypeScript interface definitions and the seed array used to generate that migration — it does not contain runtime logic. At runtime, all Edge Functions query org_model_preferences first (user's saved choice), then fall back to the row in available_models where default_for_step_key matches the step — no hardcoded model IDs anywhere in function code.

The live model list shown to users on /settings/models and /create is always read from the available_models table via get-available-models. For the OpenRouter provider only, get-available-models additionally calls https://openrouter.ai/api/v1/models to merge any live models not yet in the DB. For all other providers the DB catalog is authoritative.

> **RULE:** Model IDs must never be hardcoded in Edge Functions or UI components. Always resolve via org_model_preferences → available_models default chain.
> **RULE:** Adding or removing a model requires only an INSERT/UPDATE/DELETE on the available_models table. No code change required. Setting is_active=false hides it immediately from all UI without deleting history.


### 7.1 Image Generation models


Provider: OpenRouter (provider_key: 'openrouter')
For OpenRouter image models the org either uses the platform key (key_source: 'user_or_platform') or their own OpenRouter key. The full live model list is fetched from https://openrouter.ai/api/v1/models when the org has a key. System default seeded in available_models:

| Model ID | model_label | default_for_step_key | output_modalities | cost_tier | Notes |
| --- | --- | --- | --- | --- | --- |
| google/gemini-3.1-flash-image-preview | Gemini 3.1 Flash Image Preview | image_generation | ["image","text"] | mid | System default for image generation via OpenRouter. Released Feb 26, 2026. Supports extended aspect ratios (1:4, 4:1, 1:8, 8:1) and 0.5K image_size. |
| google/gemini-2.5-flash-image | Gemini 2.5 Flash Image | — | ["image","text"] | cheap | Older Gemini image model. Lower cost, good quality/price ratio. |
| black-forest-labs/flux.2-pro | FLUX.2 Pro | — | ["image"] | premium | Image-only output. High-res photorealism. Use `modalities: ["image"]` — no "text". |
| black-forest-labs/flux.2-flex | FLUX.2 Flex | — | ["image"] | mid | Image-only output. Flexible FLUX variant. |
| sourceful/riverflow-v2-standard-preview | Riverflow v2 Standard | — | ["image"] | mid | Image-only output. Supports `font_inputs` in image_config for custom typography. |

> **RULE:** `output_modalities` in the table above maps directly to the `modalities` parameter in the OpenRouter API request. Seed these values in migration 0005. openrouter.ts reads output_modalities from the available_models row — never hardcode which models are image-only vs text+image.

All additional OpenRouter image models are accessible from the live API fetch when org has an OpenRouter key stored. Filter by output_modalities.includes("image") client-side in get-available-models.

> **NOTE — OpenAI image via OpenRouter:** `openai/gpt-image-1` and `openai/gpt-image-2` are NOT available on OpenRouter (as of May 2026). To use GPT Image 2, use the direct `openai.ts` adapter with `gpt-image-2` model and `provider_key: 'openai'`. Do NOT seed `openai/gpt-image-*` in the OpenRouter table.

Provider: fal.ai (provider_key: 'fal')
Requires org's fal.ai API key in org_provider_api_keys. key_source: 'user_required' for all fal models. Seeded models:

| Model ID | model_label | cost_tier | release_date | Notes |
| --- | --- | --- | --- | --- |
| fal-ai/nano-banana-2 | Nano Banana 2 (Gemini 3.1 Flash Image) | mid | Released Feb 26, 2026 | Newer Gemini 3.1 Flash Image. Preferred default for fal.ai image generation. Supports `aspect_ratio` enum (including extended ratios: auto, 4:1, 1:4, 8:1, 1:8) and `resolution` (0.5K/1K/2K/4K). |
| fal-ai/nano-banana | Nano Banana (Gemini 2.5 Flash Image) | cheap | Released Oct 7, 2025 | Older Gemini 2.5 Flash variant. Fast and cheap, good for volume. Supports `aspect_ratio` enum (21:9 to 9:16, no extended ratios, no `resolution` param). |
| fal-ai/bytedance/seedream/v4/text-to-image | SeeDream v4 | mid | — | High quality ByteDance image model. Uses `image_size` named enum (`square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`, `auto`, `auto_2K`, `auto_4K`) or `{width, height}` object. No `aspect_ratio` param. |
| fal-ai/qwen-image | Qwen Image | cheap | — | Chinese model. Cheap, decent quality for standard B2B content. Uses `image_size` named enum or `{width, height}`. Has native `negative_prompt` field. Supports `acceleration` param (`none`/`regular`/`high`) and `use_turbo` flag. |
| fal-ai/flux-pro/kontext/max/text-to-image | FLUX Pro Kontext Max | premium | — | Top-tier FLUX text-to-image. Uses `aspect_ratio` enum (21:9, 16:9, 4:3, 3:2, 1:1, 2:3, 3:4, 9:16, 9:21). `output_format` defaults to `jpeg` — set to `png` for lossless. Has `guidance_scale` and `enhance_prompt` params. |

Provider: Google AI Studio (provider_key: 'google_ai_studio')
Requires org's Google AI Studio API key in org_provider_api_keys. key_source: 'user_required'. Seeded models:

| Model ID | model_label | cost_tier | Notes |
| --- | --- | --- | --- |
| gemini-3.1-flash-image-preview | Gemini 3.1 Flash Image Preview | mid | Same capability as OpenRouter route but billed direct to org's Google account. |
| gemini-3-pro-image-preview | Gemini 3 Pro Image Preview | premium | Highest quality Google image model. |
| gemini-2.5-flash-image | Gemini 2.5 Flash Image | cheap | Cheaper, older generation. Good quality/cost ratio. |


### 7.2 Video Generation models


System default: Google AI Studio model 'veo-3.1-generate-preview' (default_for_step_key: 'video_generation').
Requires org's Google AI Studio key. Orgs without a Google AI Studio key see a prompt to add their key in /settings/models before video generation is available.

Provider: OpenRouter (provider_key: 'openrouter')
| Model ID | model_label | cost_tier | Notes |
| --- | --- | --- | --- |
| google/veo-3.1-lite | Veo 3.1 Lite | mid | Fastest Veo variant. Good for short clips. |
| google/veo-3.1-fast | Veo 3.1 Fast | mid | Balance of speed and quality. |
| google/veo-3.1 | Veo 3.1 | premium | Full quality Veo 3.1. |
| kwaivgi/kling-video-o1 | Kling Video O1 | premium | Slow but cinematic output. |
| kwaivgi/kling-v3.0-std | Kling v3.0 Standard | mid | Good quality, reasonable speed. |
| kwaivgi/kling-v3.0-pro | Kling v3.0 Pro | premium | Kling highest quality tier. |

Provider: fal.ai (provider_key: 'fal')
| Model ID | model_label | cost_tier | Notes |
| --- | --- | --- | --- |
| fal-ai/veo3 | Veo 3 via fal.ai | premium | Google Veo 3 routed via fal.ai. |
| fal-ai/kling-video/v2.5-turbo/pro/text-to-video | Kling v2.5 Turbo Pro | premium | Fast Kling generation via fal.ai. |
| fal-ai/wan-25-preview/text-to-video | WAN 2.5 Preview | mid | Open-weight video model. |
| fal-ai/ovi | Ovi | mid | Alternative fal.ai native video model. |

Provider: Google AI Studio (provider_key: 'google_ai_studio')
| Model ID | model_label | default_for_step_key | cost_tier | Notes |
| --- | --- | --- | --- | --- |
| veo-3.1-generate-preview | Veo 3.1 Generate Preview | video_generation | premium | System default for video generation. Requires Google AI Studio key. |


### 7.3 Text models (Prompt Assembly, Relevance Scoring, Outreach Copy, Campaign Brief, Brand Embedding)


System default for all text step_keys: Google AI Studio 'gemini-3-flash-preview'.
System default for brand_embedding: OpenRouter 'perplexity/pplx-embed-v1-0.6b'.

Provider: OpenRouter (provider_key: 'openrouter')
| Model ID | model_label | default_for_step_key | cost_tier | Notes |
| --- | --- | --- | --- | --- |
| perplexity/pplx-embed-v1-0.6b | Perplexity Embed v1 0.6B | brand_embedding | cheap | System default for brand embedding. Fast, lightweight embedding model via OpenRouter. No org key needed — uses platform key. |
| deepseek/deepseek-v4-pro | DeepSeek V4 Pro | — | mid | Strong reasoning. Good for complex copy. |
| deepseek/deepseek-v4-flash | DeepSeek V4 Flash | — | cheap | Fast and cheap. Good for relevance scoring. |
| qwen/qwen3.5-plus-20260420 | Qwen 3.5 Plus | — | cheap | Chinese LLM. Excellent for Asia-market outreach copy. |
| qwen/qwen3.6-flash | Qwen 3.6 Flash | — | cheap | Fast Qwen variant. |
| qwen/qwen3.6-max-preview | Qwen 3.6 Max Preview | — | mid | Highest quality Qwen for text generation. |
| anthropic/claude-opus-4.7 | Claude Opus 4.7 | — | premium | Most capable Anthropic model via OpenRouter. Best for complex, long-running agentic tasks and coding. |
| anthropic/claude-sonnet-4.6 | Claude Sonnet 4.6 | — | premium | Latest Sonnet via OpenRouter. Best balance of speed and intelligence. |
| anthropic/claude-sonnet-4.5 | Claude Sonnet 4.5 | — | mid | Slightly older Sonnet. Reliable for outreach. |
| google/gemini-3.1-flash-lite-preview | Gemini 3.1 Flash Lite Preview | — | cheap | Fast, cheap Google text model via OpenRouter. |
| google/gemini-3-flash-preview | Gemini 3 Flash Preview | — | cheap | System-default-compatible via OpenRouter. |
| google/gemini-2.5-pro | Gemini 2.5 Pro | — | premium | Highest quality Google text model via OpenRouter. |

Provider: Google AI Studio (provider_key: 'google_ai_studio')
| Model ID | model_label | default_for_step_key | cost_tier | Notes |
| --- | --- | --- | --- | --- |
| gemini-3-flash-preview | Gemini 3 Flash Preview | prompt_assembly, relevance_scoring, outreach_copy, campaign_brief | cheap | System default for all text steps. Fast and cheap. |
| gemini-3.1-flash-lite-preview | Gemini 3.1 Flash Lite Preview | — | cheap | Even faster/cheaper text option. |
| gemini-3.1-pro-preview | Gemini 3.1 Pro Preview | — | premium | Highest quality for campaign briefs. |
| gemini-2.5-pro | Gemini 2.5 Pro | — | premium | Previous gen Pro model. |
| gemini-2.5-flash-lite | Gemini 2.5 Flash Lite | — | cheap | Budget Google text option. |

Provider: Anthropic (provider_key: 'anthropic')
| Model ID | model_label | cost_tier | Notes |
| --- | --- | --- | --- |
| claude-opus-4-7 | Claude Opus 4.7 | premium | Most capable Anthropic model. Best for complex, long-running agentic tasks. Step-change improvement in coding and sustained reasoning. |
| claude-sonnet-4-6 | Claude Sonnet 4.6 | premium | Latest Sonnet. Best balance of speed and intelligence for outreach copy and campaign briefs. |
| claude-sonnet-4-5-20250929 | Claude Sonnet 4.5 | mid | Slightly older Sonnet. Reliable quality. |
| claude-haiku-4-5-20251001 | Claude Haiku 4.5 | cheap | Fastest Anthropic model. Good for bulk relevance scoring. |

Provider: OpenAI (provider_key: 'openai')
| Model ID | model_label | cost_tier | Notes |
| --- | --- | --- | --- |
| gpt-5.4 | GPT-5.4 | premium | Previous OpenAI flagship. Affordable alternative to gpt-5.5 for coding and professional tasks. |
| gpt-5.4-mini | GPT-5.4 Mini | mid | Smaller, faster, cheaper GPT-5.4 variant. |
| gpt-5.5 | GPT-5.5 | premium | Most capable OpenAI model. |
| gpt-image-2 | GPT Image 2 | premium | State-of-the-art OpenAI image model. Available via DIRECT OpenAI API only — NOT available via OpenRouter. Requires a separate `callOpenAIImage()` function in openai.ts using POST `/v1/images/generations`. Use `model: "gpt-image-2"`, `prompt`, and `size` params. Returns base64 PNG in `data[0].b64_json`. key_source: 'user_or_platform'. |
| text-embedding-3-small | Text Embedding 3 Small | cheap | Alternative embedding model. Switch to this in /settings/models if preferred over the OpenRouter default. |


### 7.4 System defaults summary

| Step key | Default provider_key | Default model_id |
| --- | --- | --- |
| image_generation | openrouter | google/gemini-3.1-flash-image-preview |
| video_generation | google_ai_studio | veo-3.1-generate-preview |
| prompt_assembly | google_ai_studio | gemini-3-flash-preview |
| relevance_scoring | google_ai_studio | gemini-3-flash-preview |
| outreach_copy | google_ai_studio | gemini-3-flash-preview |
| campaign_brief | google_ai_studio | gemini-3-flash-preview |
| brand_embedding | openrouter | perplexity/pplx-embed-v1-0.6b |

> **NOTE:** If an org has no key for the default provider of a step and no org_model_preferences row, the provider router returns HTTP 403 with a clear message: 'No API key found for [Provider]. Add your key in Settings → Model Settings, or switch to a different provider.' There is no silent fallback to a different provider.


### 7.5 Recommendations carousel

The recommendations carousel on /settings/models and /create is DB-driven. It shows rows from available_models where is_recommended=true, ordered by recommendation_order ASC. The recommendation_text field is updated directly in Supabase Table Editor — no code change required.

Seeded recommendations (operator can update at any time via Table Editor):
| Order | Model | Recommendation text |
| --- | --- | --- |
| 1 | fal-ai/nano-banana-2 | 'Nano Banana 2 (Gemini 3.1 Flash Image) — Released Feb 26, 2026. The most advanced fal.ai image model. Superior prompt adherence and resolution. Great for premium campaigns.' |
| 2 | fal-ai/nano-banana | 'Nano Banana (Gemini 2.5 Flash Image) — Released Oct 7, 2025. Our fastest, most affordable image model. Perfect for high-volume campaigns on a tight budget.' |
| 3 | fal-ai/qwen-image | 'Qwen Image — For a decent quality and cheaper option, Chinese models like Qwen deliver strong results for standard B2B content at a fraction of the cost.' |
| 4 | veo-3.1-generate-preview | 'Veo 3.1 Generate Preview (Google AI Studio) — The highest quality AI video model available today. Requires your Google AI Studio key.' |
| 5 | claude-sonnet-4-6 | 'Claude Sonnet 4.6 (Anthropic) — Best-in-class for nuanced, high-converting outreach copy. Recommended for personalise and campaign brief steps.' |
| 6 | gemini-3-flash-preview | 'Gemini 3 Flash Preview (Google AI Studio) — System default for all text steps. Fast, cheap, and globally capable. Add your Google AI Studio key to unlock it.' |


---

## 8. Supabase Cron Jobs (pg_cron)

All cron jobs are defined in migration 0004_cron_jobs.sql. They call Edge Functions via HTTP POST to the function's public URL with the Supabase service role key in the Authorization header.

| Job name | Schedule + description |
| --- | --- |
| ingest-all-signals | Every 15 minutes (*/15 * * * *) — calls ingest-signals Edge Function. The function internally: (1) skips any org where signal_ingestion_enabled=false — no adapters called, no quota used; (2) for enabled orgs, checks last_signal_ingestion_at against signal_ingestion_frequency and skips if not yet due; (3) checks last_scraped_at vs cron_expression per feed_config to avoid redundant per-source calls. |
| poll-generation-jobs | Every 30 seconds (no pg_cron support for <1min — use Supabase Realtime subscription in the Edge Function itself on a 30s loop, or set to every minute as minimum cron). Updates pending/processing generation_jobs. |
| reset-monthly-quotas | 1st of each month at 00:00 UTC (0 0 1 * *) — sets image_used=0 and video_used=0 for all orgs. Updates quota_reset_at to first day of next month. |
| archive-old-signals | Daily at 02:00 UTC (0 2 * * *) — sets status='archived' on signals older than 90 days where status != 'selected'. Never hard deletes. |
| cleanup-apify-signals | Hourly (0 * * * *) — enforces the 24h LinkedIn data retention rule from Section 14.3. Deletes rows from the signals table WHERE source_type = 'apify_linkedin' AND scraped_at < now() - INTERVAL '24 hours'. Only the raw Apify response is discarded via this deletion. signal rows that have been selected (status = 'selected') are NOT deleted regardless of age — they are retained because the user explicitly used them. Only unread/dismissed apify_linkedin signals older than 24h are removed. |

> **NOTE:** pg_cron minimum resolution is 1 minute. For the 30-second poll requirement, implement using Supabase Realtime or a self-scheduling Edge Function that re-invokes itself after a delay. Document the chosen approach in code comments.


---

## 9. Signal Ingestion and Data Sources


### 9.1 Ingestion logic

The ingest-signals function runs per org. First check: if orgs.signal_ingestion_enabled = false, skip the org immediately — no source adapters are called, no quota is consumed. Second check: compare now() against last_signal_ingestion_at + the interval derived from signal_ingestion_frequency (daily = 1 day, every_2_days = 2 days, every_3_days = 3 days, every_5_days = 5 days, monthly = 30 days). If not yet due, skip. If due, proceed: for each active feed_config belonging to the org, call the appropriate source adapter. Results are filtered against the org's active_themes and competitor_names — only signals matching at least one term are stored. This is intentional: each org sees only relevant signals, not a full firehose. On successful completion: set orgs.last_signal_ingestion_at = now().

Deduplication: before inserting, compute SHA-256(url) and check if url_hash already exists for org_id. If exists, skip. Use INSERT ... ON CONFLICT DO NOTHING for atomicity.

Relevance scoring: TF-IDF keyword overlap between (headline + summary) and (active_themes + competitor_names + decision_maker_titles). Score normalised to 0.0–1.0. Stored in signals.relevance_score.

> **RULE:** If a source adapter throws an error (network timeout, rate limit, invalid response), the error must be caught, feed_configs.error_count incremented, and the job must continue to the next source. A single failing source must never abort the entire ingest run.


### 9.2 Always-on sources (no API key required)

| Source | Implementation notes |
| --- | --- |
| RSS / Atom feeds | feedparser equivalent for Deno. User-entered URLs plus auto-generated Google Alerts RSS for each competitor name and active theme. Validate feed URL with HTTP HEAD before saving feed_config. |
| Hacker News (Algolia) | GET https://hn.algolia.com/api/v1/search?query={keyword}&tags=story. Free, no auth. Map hits to Signal schema. |
| Product Hunt | GET https://api.producthunt.com/v2/api/graphql with query for posts. No auth required for public data. Map to Signal. |
| GitHub public API | GET https://api.github.com/search/repositories?q={org_name} and /orgs/{org}/events. 60 req/hr unauthed. Store optional github_token in org_api_keys for 5000 req/hr. |
| YouTube Data API v3 | Requires YouTube API key stored in org_api_keys as youtube_api_key. Search channel uploads and activity. 10,000 units/day free quota. |
| GDELT Project | GET https://api.gdeltproject.org/api/v2/doc/doc?query={keyword}&mode=artlist&format=json. Free. Strong Africa, ME, South Asia, LATAM coverage. Rate limited — add 2s delay between calls. |
| Wikipedia / Wikidata | Used for ICP enrichment baseline — company lookups. REST API, no key required. |


### 9.3 Regional sources — auto-activated by country_code

| Countries | Region | Auto-activated RSS sources |
| --- | --- | --- |
| IN | India | Economic Times, YourStory, Inc42, Moneycontrol, NASSCOM, BSE/NSE filings, Entrackr, Tracxn |
| GB + EU | Europe | EU Startups, Sifted, Tech.eu, Crunchbase EU, Euronews Business, EIB |
| AU, NZ | Australia / NZ | StartupSmart, SmartCompany, AFR Tech, AIIA, CRN Australia |
| NG, ZA, KE, GH, EG | Africa | TechCabal, Disrupt Africa, Ventureburn, WeeTracker, PerSol |
| AE, SA, IL | Middle East | Wamda, ArabNet, MENA Bytes, Step Feed |
| SG, MY, ID, PH, VN, TH | Southeast Asia | e27, KrASIA, Deal Street Asia, Tech In Asia |
| US, CA, LATAM | Americas | TechCrunch, VentureBeat, Axios Pro, SEC EDGAR filings |

> **NOTE:** Regional sources are created as feed_config rows with auto_activated=true when org.country_code is set during onboarding. The user can view and disable individual auto-activated sources in /settings but cannot accidentally delete them without explicit confirmation.


### 9.4 Optional sources — user brings API key

| Source | Behaviour when key absent |
| --- | --- |
| Reddit API (client_id + secret) | Silently skipped. No error shown. feed_config row still exists with is_active=false until key is provided. |
| LinkedIn via Apify (apify_token) | Silently skipped. UI shows 'LinkedIn signals: not configured' in settings. Requires user opt-in checkbox + disclaimer: 'Uses third-party Apify scraper. Not official LinkedIn API. Raw data not stored beyond 24 hours.' The apify_token is stored per-org in org_api_keys (key_name = 'apify_token'). On fully_subscribed plan, the token UI is hidden but no platform APIFY_API_KEY is used for signals — LinkedIn signals are simply unavailable on fully_subscribed unless the operator configures it differently via a custom feed_config. |
| NewsAPI.org (newsapi_key) | Silently skipped. RSS feeds continue to provide similar coverage. |
| Twitter/X API v2 (twitter_bearer) | Silently skipped. No Twitter signals without key. |
| AI provider keys (openrouter, fal, google_ai_studio, anthropic, openai) | Stored per-provider in org_provider_api_keys. If absent for a provider, the platform env var for that provider is used when key_source = 'user_or_platform'. Models with key_source = 'user_required' are blocked with HTTP 403 until the org provides their key. Models with key_source = 'platform' always use the platform env var regardless of org key. Org key always takes priority over platform key when both present. |
| Clearbit (clearbit_key) | If absent, Clearbit step in ICP waterfall is skipped. Enrichment continues with remaining steps. |
| Tavily Search (tavily_api_key) | Silently skipped if key absent. When active: runs one search query per active_theme and per competitor_name on each ingest cycle. Returns up to 10 ranked web results normalised to Signal schema. Rate limits depend on the org’s Tavily plan tier. On fully_subscribed plan: org cannot enter a key — adapter uses TAVILY_API_KEY platform env var if set by operator; silently skipped if env var not set. |
| Brave Search (brave_search_api_key) | Silently skipped if key absent. When active: runs one search query per active_theme and per competitor_name on each ingest cycle. Returns up to 20 ranked web results normalised to Signal schema. Brave Search indexes the open web independently — good complement to RSS-based sources and not subject to Google’s personalisation. On fully_subscribed plan: org cannot enter a key — adapter uses BRAVE_SEARCH_API_KEY platform env var if set by operator; silently skipped if env var not set. |


### 9.5 Custom data sources — user-entered in onboarding Section 5

Each user-entered item is validated and converted to a feed_config row on save:
- → Competitor company name
Creates Google Alerts RSS URL: https://www.google.com/alerts/feeds/{encoded_query}/en_GB for that name. Stored as rss type.
- → LinkedIn profile URL (person or company)
Stored as apify_linkedin type. Only active if apify_token present. Otherwise saved as inactive.
- → Direct RSS or Atom URL
HTTP HEAD request to validate. If returns 200 and Content-Type contains xml or rss or atom, save as rss type. Otherwise reject with error message.
- → News publication name
Attempt to find official RSS by appending /rss, /feed, /rss.xml to publication domain. Fallback to Google Alerts RSS for the publication name.
- → Subreddit name
Save as reddit type. Active only if reddit_client_id + reddit_secret present.
- → YouTube channel URL
Extract channel ID, save as youtube type. Active only if youtube_api_key present.
- → Podcast RSS URL
Validated same as RSS. Stored as rss type.


---

## 10. Brand Onboarding Wizard

5-section multi-step form. Required before accessing the main dashboard. Progress is saved after each section — user can leave and return. Show a progress bar (1 of 5, 2 of 5...). UX must feel like a guided interview, not a data entry form.

> **RULE:** onboarding_complete must not be set to true until all required fields in Sections 1 and 2 are filled. Sections 3, 4, and 5 have no required fields — they improve quality but must not block completion.

Section 1 — Company identity (required fields marked *)
- Company name *
- Country / region * (dropdown of ISO countries — sets country_code, triggers regional source auto-activation)
- Industry sector * (dropdown: Technology | Financial Services | Healthcare | Manufacturing | Retail | Professional Services | Media | Education | Other)
- Company size * (1-10 | 11-50 | 51-200 | 201-1000 | 1000+)
- Website URL
- Founding year
- One-sentence pitch * — 'What problem do you solve, for whom?' Max 200 chars.
- Extended description — 3 to 5 sentences. Text area.
- Products / services — up to 5 entries, each with name + short description (2 fields per entry)
- Revenue model (SaaS | Consulting | Product | Marketplace | Other)
- Geographies served — multi-select country list
- Industries targeted — multi-select from same industry list
- Company sizes targeted — multi-select: SMB | Mid-market | Enterprise
- Primary decision-maker titles — free text tags, up to 5 (e.g. VP Marketing, CMO, Founder)

Section 2 — Brand voice and tone (required *)
- Tone sliders * — 5 sliders 0-100. Labels: Formal/Conversational, Safe/Bold, Corporate/Human, Data-driven/Story-led, Conservative/Provocative. Default all at 50. Stored as individual integer columns.
- Sentence length (Short | Medium | Long)
- Jargon level (Avoid | Moderate | Heavy)
- Emoji usage (Never | Sparingly | Freely)
- CTA style (Soft | Direct | Urgent)
- Voice examples — up to 3 text areas. Label: 'Paste an example post or paragraph that sounds exactly like your brand — this is the most important input for content quality.' Min 1 example strongly encouraged but not required.

Section 3 — Visual identity
- Brand colours — 3 colour pickers: Primary, Secondary, Accent hex
- Logo upload — PNG or SVG. Max 5MB. Stored at brands/{org_id}/logo.{ext}
- Brand guidelines PDF — max 20MB. Stored at brands/{org_id}/guidelines.pdf. On upload save-onboarding extracts raw text using pdfjs-dist (`npm:pdfjs-dist` Deno-compatible) and saves it to brand_contexts.brand_guidelines_text. If extraction fails (scanned/image PDF), brand_guidelines_text is set to null and the upload still succeeds. In build-prompt, if brand_guidelines_text is not null, it is prepended to the prompt as an additional context block labelled "Brand Guidelines" before voice_examples
- Reference images — up to 5 image uploads. Label: 'Images that feel like your brand'. Stored at brands/{org_id}/ref/{n}.{ext}
- Anti-reference images — up to 3. Label: 'Images you would never use'. These become negative_prompt inputs. Stored at brands/{org_id}/antiref/{n}.{ext}
- Visual style (Photography | Illustration | Abstract)
- Dark/light preference (Dark | Light | Neutral)
- Composition (Busy | Balanced | Minimal)
- Human faces (Yes | No | Diverse only)
- Location style (Real locations | Studio | Abstract)

Section 4 — Campaign context
- Active campaign themes — up to 3 text inputs. Label: 'What are you currently pushing? e.g. Q3 product launch, hiring push, AI thought leadership'. These score signal relevance.
- Competitors to monitor — up to 10 company names or domains. Auto-creates feed_config entries + used as negative context in prompts ('do not imply similarity to [name]').
- Primary platform (LinkedIn | Twitter-X | Instagram | WhatsApp Business | Email)
- Secondary platform (same options)
- Target posts per week — number input
- Timezone — IANA timezone picker. Auto-detected from country_code. User can override.
- Topics to NEVER mention — free text, comma-separated
- Phrases to NEVER use — free text, comma-separated
- Visual styles to avoid — free text
- Political/religious/cultural sensitivities — free text

Section 5 — Optional enrichments

> **NOTE (fully_subscribed plan):** When plan_tier = 'fully_subscribed', ALL key entry fields in this section are locked and hidden. A banner is shown instead: 'Your plan includes platform-managed integrations. API keys are configured by the platform operator — you do not need to provide your own.' Data source adapters (Tavily, Brave Search, Reddit, etc.) and AI providers use platform-level keys set by the operator via env vars. Sources for which the operator has not set a platform env var are silently skipped for this org.

> **SECURITY:** Every API key entered by the client is AES-256-GCM encrypted using the platform ENCRYPTION_KEY before it is written to the database. The plaintext key is never stored, never logged, and never returned in any API response. After saving, the key cannot be viewed — only replaced or deleted. The encrypted value is decrypted exclusively inside Edge Functions at call time and is never exposed to the frontend.

- Reddit API — two fields: client_id and client_secret. Optional. Encrypted on save to org_api_keys.
- LinkedIn via Apify — one field: Apify token. Optional. Requires explicit opt-in checkbox with disclaimer text before field is shown.
- Twitter/X Bearer token — optional. Encrypted on save to org_api_keys.
- NewsAPI.org key — optional. Encrypted on save to org_api_keys.
- Tavily Search API key — optional. Enables AI-powered web search across active themes and competitor names. Each ingest cycle runs one Tavily query per active theme and per competitor. Encrypted on save to org_api_keys.
- Brave Search API key — optional. Enables open-web keyword search across active themes and competitor names. Brave indexes the web independently from Google. Each ingest cycle runs one query per active theme and per competitor. Encrypted on save to org_api_keys.
- AI Provider API Keys — this sub-section collects keys for each AI provider. All keys are AES-256-GCM encrypted and stored in org_provider_api_keys. Key entry fields are DISABLED when plan_tier = 'fully_subscribed'. Each provider card shows: key status (set / not set), a masked input field, Save button, Delete button.
  - OpenRouter API Key — optional. Unlocks full live model list via OpenRouter. Required for models with key_source = 'user_required' on OpenRouter. For 'user_or_platform' models, providing this removes dependency on platform quota and rate limits.
  - fal.ai API Key — required to use any fal.ai image or video model (fal-ai/nano-banana, fal-ai/flux-pro/kontext/max/text-to-image, fal-ai/veo3, etc.). Without it, all fal models are locked.
  - Google AI Studio API Key — required to use Gemini image models, Veo video models, and Gemini text models directly. Strongly recommended — Google AI Studio is the system default provider for most steps.
  - Anthropic API Key — required to use Claude models directly without routing through OpenRouter (claude-sonnet-4-6, claude-haiku-4-5, etc.).
  - OpenAI API Key — required to use GPT-5.x models and text-embedding-3-small directly. The brand_embedding step uses OpenAI by default.
  > **NOTE:** Each provider card shows whether a platform key is available as fallback. platform_key_available=true shows 'Platform key active — your key will take priority'. If false and no org key set, models requiring that provider are unavailable.
- Clearbit API key — optional. Encrypted on save to org_api_keys.
- YouTube API key — optional. Required for YouTube channel monitoring. Encrypted on save to org_api_keys.
- Custom data sources — free text entry area. Accepts: competitor names, LinkedIn URLs, RSS URLs, publication names, subreddit names, YouTube URLs, podcast RSS URLs. Each line = one source. Validated on save. Errors shown per line.


---

## 11. Frontend Pages and Routing


### 11.1 Route map

| Route | Page description + auth requirement |
| --- | --- |
| / | Landing page — public. Value prop, feature highlights, pricing table, login/signup CTA. No dashboard content visible to unauthenticated users. |
| /signup | Signup — email + password. Creates Supabase Auth user. On success → /create-org. |
| /create-org | Organisation creation — shown after first successful signup before onboarding. Two fields: company name and org slug. Calls create-org Edge Function on submit. On success → /onboarding. Auth guard: must be logged in; skipped (redirect to /onboarding) if user already has an active org_members row. |
| /login | Login. On success: if onboarding_complete=false → /onboarding. If true → /dashboard. |
| /onboarding | Brand onboarding wizard (5-section form). Protected: must be logged in. Cannot be skipped. Redirect here if onboarding_complete=false. |
| /dashboard | Trend dashboard — home base for returning users. Protected + onboarding complete required. |
| /dashboard/signal/[id] | Signal detail view — full article context, auto-populated prompt tag suggestions. Protected. |
| /create | Prompt tag editor. Optionally pre-loaded with signal_id from dashboard. Protected. |
| /create/[job_id] | Generation result: preview, download, feedback, regenerate. Protected. |
| /icp | ICP definition form + prospect table. Protected. |
| /icp/[prospect_id]/personalise | Outreach copy generation and review for one prospect. Protected. |
| /campaigns | Campaign list — all org campaigns with status, type, prospect count, copy completion meter. Protected. |
| /campaigns/new | Campaign creation wizard — name, type, date range, channel mix, link asset. Protected. |
| /campaigns/[id] | Campaign detail — content calendar, prospect copy tracker, generate brief, PDF preview, export. Protected. |
| /settings | Org settings: data sources, custom sources, API keys, signal ingestion toggle and frequency selector. Protected — admin/owner only for API key management and ingestion settings. |
| /settings/billing | Dodo Payments plan management + usage meter. Protected — owner only. |
| /settings/team | Seat management: view members, invite, remove. Protected — owner/admin. |
| /settings/models | AI Model Preferences — select provider and model per step, manage per-provider API keys, view recommendations carousel. Protected — admin/owner only. |
| /settings/usage | AI usage and cost — token consumption and estimated cost by model, step, and key source for this org. Protected — admin/owner only. |
| /invite/accept | Invite acceptance: validates token, sets password, associates user to org. |


### 11.2 Signal Ingestion Settings (/settings — ingestion section)

The /settings page includes a dedicated 'Signal Ingestion' section. Admin and owner roles can access it. It contains:

**Ingestion toggle:** A prominent on/off toggle labelled 'Automatically fetch signals'. Default: OFF for new orgs. When OFF: a banner reads 'Signal ingestion is paused. Turn it on to start receiving trend signals.' No cron work runs for this org. When turned ON for the first time: triggers an immediate ingest run (so the user sees signals within seconds, not waiting for the next cron tick). Turning it OFF again halts all future ingestion immediately.

**Frequency selector (visible only when toggle is ON):** A radio group or segmented control with options:
- Every day (default)
- Every 2 days
- Every 3 days
- Every 5 days
- Every month

Selecting a frequency writes to orgs.signal_ingestion_frequency immediately (no separate Save needed — auto-save on change). Show the last ingestion time below the selector: 'Last fetched: [relative time from last_signal_ingestion_at]' or 'Never fetched yet' if null.

**'Fetch now' button:** Always visible when ingestion is enabled. Calls ingest-signals immediately (HTTP POST to Edge Function, bypassing the frequency check). Useful for users who want fresh signals on demand without changing their schedule. Shows a spinner and 'Fetching signals...' during the call. On success: updates the 'Last fetched' timestamp.

> **NOTE:** When signal_ingestion_enabled is toggled ON and last_signal_ingestion_at is null (first activation), ingest-signals must run immediately regardless of frequency. This ensures the user sees signals without waiting up to 30 days.


### 11.3 Trend dashboard (/dashboard)

- Signal cards sorted by relevance_score DESC then published_at DESC by default
- Filter bar: date range (7 days / 30 days / 90 days / all), source type (dropdown), tags (multi-select)
- Each card shows: headline, source name + icon, time ago, relevance score as coloured badge (green >0.7, amber 0.4-0.7, grey <0.4), matched themes chips
- Card actions: 'Use this trend' button → /create?signal_id={id}, 'Dismiss' button (soft delete). When the 'Show dismissed' toggle is ON, dismissed cards also show a 'Restore' button. Restore calls a PATCH to signals (sets status back to 'unread', clears dismissed_at and dismissed_by). No Edge Function required — the frontend calls Supabase client directly (RLS allows member to UPDATE their own org signals).
- Dismissed signals hidden by default. 'Show dismissed' toggle at top of feed.
- Empty state — new user with no signals yet: 'Your first signals will appear within 15 minutes. We are scanning your configured sources.' with loading animation.
- Empty state — all dismissed: 'No new signals. Check back soon, or add more sources in Settings.'
- Usage meter in header: 'Images: 12/50   Videos: 2/5' — visible on all dashboard pages


### 11.4 Prompt tag editor (/create)

The /create page is the core USP of GTM Engine for non-technical marketing professionals. It must feel like a creative tool, not a form. Every option must be visually obvious — no free-text fields where a card or toggle will do.

**Page layout (two-column on desktop, single column on mobile):**
- **Left column (60%):** The tag card editor — the main creative surface
- **Right column (40%):** Brand context preview + model selector + Generate button

---

**Tag Card Editor — non-technical UX**

All prompt_tags fields are rendered as visual choice cards, NOT plain text inputs. The user taps/clicks a card to select it. Selected cards show a coloured ring (indigo-500). No dropdowns, no text boxes for choices. Only the CTA Text and Additional Notes fields use text inputs.

**Subject field (required):** A text input at the very top, pre-filled from the signal headline if arriving from /dashboard. Label: ‘What is this image/video about?’ Placeholder: ‘e.g. AI is changing the way financial teams work’. Max 200 chars. Character count shown.

**Visual Style — 5 icon cards in a row:**

| Card | Icon | Label |
| --- | --- | --- |
| Photography | Camera icon | Photography |
| Illustration | Pencil icon | Illustration |
| Abstract | Shapes icon | Abstract |
| 3D | Cube icon | 3D Render |
| Flat design | Layout icon | Flat Design |

**Mood — 6 cards in a 3×2 grid:**

| Card | Emoji | Label |
| --- | --- | --- |
| Professional | 💼 | Professional |
| Bold | ⚡ | Bold |
| Calm | 🌿 | Calm |
| Energetic | 🚀 | Energetic |
| Minimal | ◻️ | Minimal |
| Warm | ☀️ | Warm |

**Platform — 5 cards showing the platform logo + aspect ratio implication:**

| Card | Label | Sub-label |
| --- | --- | --- |
| LinkedIn logo | LinkedIn | Square · 4:5 |
| Instagram logo | Instagram | Square or Story |
| X logo | Twitter / X | Landscape 16:9 |
| WhatsApp logo | WhatsApp | Square · 1:1 |
| Globe icon | Generic | Any format |

Selecting a platform auto-sets aspect_ratio to the platform default. User can still override aspect ratio separately.

**Aspect Ratio — 4 visual cards showing the shape literally as an SVG rectangle:**

| Card | Shape preview | Label |
| --- | --- | --- |
| 1:1 | Square outline | Square |
| 16:9 | Wide rectangle | Landscape |
| 9:16 | Tall rectangle | Portrait / Story |
| 4:5 | Slightly tall rectangle | Portrait Feed |

**Colour Palette — 3 options shown as colour swatches:**
1. **Brand colours (default, pre-selected):** shows the org’s brand_colours (primary, secondary, accent) as three coloured circles. Label: ‘Your brand colours’.
2. **Vibrant:** high-saturation example swatch. Label: ‘Vibrant’.
3. **Monochrome:** greyscale swatch. Label: ‘Monochrome’.
The user can also type a custom hex/palette in a text field that appears when they click ‘Custom…’ below the swatches. This sets colour_palette free text.

**CTA Text (optional):** Single text input. Placeholder: ‘e.g. Book a free demo →’. Max 80 chars. Label: ‘Call to action overlay (optional)’.

**Advanced section (collapsed by default, ‘Advanced options ▾’ toggle):**
- **Negative Prompt:** textarea, pre-filled from brand_contexts.phrases_to_avoid + anti_reference_image_urls context. Label: ‘Exclude from image’. Helper: ‘Things you don’t want to appear — e.g. people, red colours, busy backgrounds’. Non-technical label deliberately.
- **Additional Notes:** textarea. Label: ‘Anything else to tell the AI’. Max 500 chars.
- **‘View full JSON’ toggle:** reveals the raw ContentJob JSON. For technical users only. Editing JSON updates form fields in real-time (bidirectional binding).

---

**Right column — Brand context preview (accordion, collapsed by default):**
Shows the brand data being injected so non-technical users understand what the AI knows:
- Brand colours (three swatches)
- Voice summary: e.g. ‘Professional, Bold, Data-driven’
- Active themes chips: e.g. ‘Q3 product launch’, ‘AI thought leadership’
- Voice example preview: first 100 chars of first voice_examples entry

Label: ‘Your brand context is automatically included ✓’

**Right column — Asset type selector (Image / Video):**
Two large toggle cards side by side:

| Card | Label | Sub-label |
| --- | --- | --- |
| Image icon | Image | Ready in ~20s |
| Video icon | Video | Ready in 2–5 min |

Selecting Video changes the model selector to show only video-compatible models and shows a banner: ‘Video jobs run in the background. You’ll get a notification when it’s ready.’

**Right column — Model selector:**
A single dropdown (not 7 step cards — those are in /settings/models). Shows only models compatible with the selected asset type. Pre-populated from the org’s saved org_model_preferences for the relevant step. Each option shows model name + provider badge + cost tier + lock icon if no key. A ‘Change default in Settings’ link below.

**Right column — Generate button (sticky at bottom on mobile):**
Large primary button: ‘Generate Image’ or ‘Generate Video’ depending on asset type selection. Calls check-quota first. If over limit: upgrade modal instead. Quota remaining shown below the button in small text: ‘38 images remaining this month’.

---

**Signal context banner (when arriving from /dashboard with signal_id):**
A pill banner at the top of the page: ‘📰 Based on: [headline truncated to 60 chars]  [View article ↗]’. Tapping ‘View article’ opens the signal detail in a side drawer without leaving /create. Subject field is pre-filled from the signal headline. The banner can be dismissed.

---

**Generation in progress (image — replaces right column result area):**
See ui-design.instructions.md §6 for the spinner component. Below spinner: animated prompt text preview showing compiled_prompt being ‘typed’ character by character. This reassures non-technical users the AI understood their choices.

**Generation complete (image — inline result in right column):**
- Image displayed at full width in right column with rounded-lg border
- Four quick-action buttons below the image (icon + label, horizontal row):
  1. **Download** — downloads PNG immediately
  2. **Refine** — opens the Refinement Panel (see Section 11.5a)
  3. **Use for campaign** — navigates to /icp with job_id pre-selected
  4. **Regenerate** — one-click regenerate with identical settings (increments version)
- Feedback row below: thumbs up / down + ‘Skip’ link

**For video generation:** after Submit, the left column shows a ‘Video submitted’ confirmation card with job_id and estimated time. The dashboard shows a live progress card via Realtime subscription to ‘job:{job_id}’.


### 11.5a Image Refinement Panel (/create — inline, not a new page)

The Refinement Panel is the key ‘fix this image’ UX. It opens as a side drawer (desktop) or bottom sheet (mobile) when the user clicks ‘Refine’ on a generated image. It must feel like a magic wand, not a form.

**Panel layout:**
- Left: the current generated image at 50% width (full width on mobile)
- Right: refinement controls

**What to fix (multi-select chips — user picks one or more):**

The chips are displayed as a wrapped flex row of pill buttons. User picks one or more:

```
[Too dark]  [Too light]  [Too busy]  [Too plain]
[Wrong colours]  [Not on-brand]  [Change background]
[Different mood]  [More professional]  [More bold]
[Add text overlay]  [Remove text]  [Different style]
[Something else…]
```

Selecting ‘Something else…’ reveals a text input. Each chip maps to a pre-built instruction string appended to additional_notes (e.g. ‘Too dark’ → ‘Increase brightness and lighting significantly. Make the image brighter and more vivid.’). These mappings are defined in REFINEMENT_CHIP_MAP in apps/web/lib/refinement-chips.ts as a plain constant — no backend changes needed. Adding or relabelling chips is a frontend-only edit.

**Strength slider:**
A single slider labelled: ‘How different from the original?’
- Left pole: ‘Small tweak’
- Right pole: ‘Completely new’
Values 1–5. Value 1 injects: ‘Keep as close to the original as possible, only change [chips selected].’ Value 5 injects: ‘Feel free to reimagine this significantly, keeping the core subject.’

**Keep / Change toggles (two toggle cards):**
- ‘Keep my brand colours’ (default ON)
- ‘Keep the subject / main element’ (default ON)

**‘Apply refinements’ button:**
Calls build-prompt with the modified prompt_tags (original tags + refinement chip instructions merged into additional_notes + strength modifier). Then calls generate-asset. Creates a new generation_jobs row with parent_job_id pointing to the original. The panel shows the new image alongside the original for comparison.

**Comparison view (after refinement generates):**
- Two images side by side: ‘Original’ | ‘Refined’
- Below each: ‘Use this’ button (primary on refined, outline on original)
- ‘Refine again’ button stays visible
- ‘Discard refinement’ link returns to the original

> **NOTE:** Refinement consumes 1 image quota per attempt. Show ‘This will use 1 image from your quota (38 remaining)’ below the Apply button. The version counter increments. Version history sidebar in /create/[job_id] shows all refinement iterations linked by parent_job_id.

> **NOTE:** The REFINEMENT_CHIP_MAP lives in apps/web/lib/refinement-chips.ts as a plain constant — it requires no DB changes or Edge Function changes. Adding or changing chip labels and their prompt instructions is a frontend-only edit.


### 11.5b Generation result page (/create/[job_id])

Reached directly via URL or from Realtime notification. Full-page view of a completed job.

- **Image:** rendered full-width (max-w-2xl centered) with download button. Filename: {org_slug}_{date}_{job_id_short}.png
- **Video:** HTML5 video player with controls. Download button. Filename: {org_slug}_{date}_{job_id_short}.mp4. ‘Share link’ button generates a signed URL (1-hour expiry) for internal review via Slack/email.
- **Feedback panel:** thumbs up / down (required) + 1–5 star rating (optional) + optional text note. Submits to generation_feedback.
- **Refinement button (images only):** opens the Refinement Panel (Section 11.5a) as a full-page side drawer.
- **‘Regenerate completely’ button:** returns to /create with current prompt_tags pre-loaded. All tag card selections restored. Changed fields highlighted with amber ring.
- **Version history sidebar:** thumbnails of all versions linked by parent_job_id, newest first. Each thumbnail: version number + ‘Original’ or ‘Refined v{n}’ badge. Clicking navigates to that job’s /create/[job_id].
- **‘Use for campaign’ button:** navigates to /icp with this job_id pre-selected as the asset.

### 11.6 AI Model Preferences (/settings/models)

This page lets admin and owner roles select which AI provider and model is used for each functional step. Preferences are stored per org in org_model_preferences. The page must clearly show: current selection, provider, key status for that provider, and the system default fallback.

Page header: Shows per-provider key status as a row of badges — one per active provider (OpenRouter, fal.ai, Google AI Studio, Anthropic, OpenAI). Green = org key set. Amber = using platform key. Red = no key, user_required models locked. Each badge links to the key input section below. A Recommendations carousel sits below the header, showing is_recommended models from available_models ordered by recommendation_order, with recommendation_text displayed. This content is DB-driven — operator updates recommendation_text directly in Supabase Table Editor, changes appear in UI immediately.

Model list loading: On page load, call get-available-models Edge Function. Returns all active models from available_models grouped by provider, plus live OpenRouter model list merged in if the org has an OpenRouter key. Show a loading spinner while fetching. On failure: show Retry button, render saved preferences from cached model_label. Never block the page from rendering saved preferences just because the live fetch failed.

Step cards: 7 cards, one per step_key. Each card shows: (1) Step name and plain-English description. (2) Searchable dropdown of compatible models filtered by model_type. Options show: model name, provider badge, cost_tier badge, estimated_time_seconds, and a lock icon if org has no key for that provider. (3) ‘Default’ badge on the system default model. (4) ‘Reset to default’ link that clears the org_model_preferences row for that step_key. (5) Current selection with model name and provider.

The 7 step cards in display order:
(1) Image Generation — ‘Model used to generate marketing images in Step 2’. model_type: image. Default: google/gemini-3.1-flash-image-preview (OpenRouter).
(2) Video Generation — ‘Model used to generate marketing videos in Step 2’. model_type: video. Default: veo-3.1-generate-preview (Google AI Studio). Shows ‘Requires Google AI Studio key’ if no key set.
(3) Prompt Assembly — ‘Model used to build the AI prompt from your trend and brand context’. model_type: text. Default: gemini-3-flash-preview (Google AI Studio).
(4) Relevance Scoring — ‘Reserved for on-demand AI-assisted signal analysis (v2 scope). In v1, ingest-signals uses TF-IDF (relevance.ts) for automatic scoring — fast, zero AI cost, runs for every org on every ingest tick. Do NOT add an AI model call inside ingest-signals in v1 — it would invoke the LLM thousands of times per day across all orgs and incur significant unexpected cost. This step card is preserved so users can configure a future re-score feature.’ model_type: text. Default: gemini-3-flash-preview (Google AI Studio).
(5) Outreach Copy — ‘Model used to write personalised prospect outreach messages’. model_type: text. Default: gemini-3-flash-preview (Google AI Studio).
(6) Campaign Brief — ‘Model used to generate posting schedules, captions, and campaign briefs’. model_type: text. Default: gemini-3-flash-preview (Google AI Studio).
(7) Brand Embedding — ‘Model used to generate the semantic embedding of your brand context for AI prompt grounding’. model_type: embedding. Default: perplexity/pplx-embed-v1-0.6b (OpenRouter). Alternative: text-embedding-3-small (OpenAI) — select this in the dropdown if you prefer OpenAI embeddings.

Provider API key management sub-section: Below the step cards, a ‘Provider API Keys’ section shows one card per active provider. Each card: provider display name, link to provider docs, key status, masked key input field, Save button, Delete button. Each card shows a permanent notice beneath the input: ‘Your key is AES-256-GCM encrypted before storage and cannot be viewed after saving — only replaced or deleted.’ Save calls save-provider-keys Edge Function. Delete calls delete-provider-key Edge Function. All fields disabled with a lock icon and tooltip ‘API key management is disabled on your current plan’ when plan_tier = ‘fully_subscribed’.

Save behaviour: ‘Save all changes’ button submits all changed step preferences in one call to save-model-preferences. Each step card also has an inline Save. On save: validate model exists in available_models with is_active=true and compatible_step_keys includes the step_key. Show success toast per step. On error: highlight card in red with reason (e.g. ‘This model does not support image generation’).

> **NOTE:** The model selector on /create lets the user pick a one-off model for a single job without changing org-wide preferences. /settings/models sets the org-wide default that pre-populates the /create selector.


### 11.7 AI Usage and Cost (/settings/usage)

Accessible to admin and owner roles only. Members cannot access. Shows the org’s own AI token and estimated cost consumption from llm_usage_events. Calls get-usage-stats Edge Function on page load.

**Date range selector:** Today | Last 7 days | Last 30 days | All time. Default: Last 30 days. Selection re-fetches immediately (no Apply button needed).

**Usage table:** One row per (provider_key, model_id, step_key) combination.
- Columns: Provider | Model | Step | Calls | Input Tokens | Output Tokens | Est. Cost (USD) | Key Source
- Key Source column: 'Platform' = cost covered by subscription; 'Your key' = billed to org’s own provider account
- Totals row at bottom

**Key source summary cards:** Two stat cards at top of page:
- 'Platform calls' — count and estimated cost on platform keys (covered by your subscription)
- 'Your API key calls' — count and estimated cost billed directly to your own provider accounts

**Empty state:** 'No AI usage recorded yet. Generate a trend image or run an outreach copy step to see usage here.'

**Disclaimer note below table:** 'Estimated costs are based on token counts and model pricing data maintained by the platform. Actual costs may differ from your provider invoice. Usage on your own API keys is billed directly by the provider — check your provider dashboard for exact charges.'

> **NOTE:** /settings/usage is read-only and for transparency only. Subscription billing is at /settings/billing. Provider API costs on org-owned keys are charged directly by the provider, not by this platform.


### 11.8 Outreach Personalise Page (/icp/[prospect_id]/personalise)

Reached by clicking a prospect row in /icp. Shows the generated personalised outreach copy for the selected prospect and platform.

**Generate / Regenerate:** If no outreach_copies row exists for this prospect, shows a Generate button that calls the personalise Edge Function. If a copy exists, shows a Regenerate button. Regeneration inserts a new outreach_copies row and does not overwrite previous versions.

**Edit:** Copy text is shown in an editable textarea. On blur, the edited text is saved via a PATCH to outreach_copies.copy_text (Supabase client direct call, status stays draft).

**Approve:** Approve button sets outreach_copies.status = approved. The textarea becomes read-only and an Approved badge is shown. Only one approved version per prospect at a time (approving a new version sets all previous approved rows for this prospect to draft).

**Export (shown once approved):**
- **Copy to clipboard:** Copies the approved copy_text to the system clipboard. Shows a Copied! toast for 2 seconds. On success, updates outreach_copies.status to exported via Supabase client.
- **Bulk CSV export (on /icp prospect table):** An Export CSV button appears above the prospect table when at least one prospect has approved copies. Exports all approved outreach_copies for the org as a CSV file with columns: first_name, last_name, email, company_name, platform, copy_text, icp_score. Generated client-side from data already loaded on the /icp page (no Edge Function required). Sets all exported rows to status=exported.

**Platform selector:** A dropdown to switch the outreach target platform (LinkedIn message, email, cold DM). Changing platform calls personalise again for the new platform. Each platform–prospect combination stores a separate outreach_copies row.

**Empty state:** 'No copy generated yet. Click Generate to create personalised outreach for this prospect.'

**Prospect sidebar:** Shows prospect name, title, company_name, enrichment_source badge, icp_score badge (green ≥0.7, amber 0.4–0.69, grey <0.4), and any missing-field warnings.


### 11.9 Campaigns list (/campaigns)

Protected. Available to all org roles. Landing page after a user clicks ‘Campaigns’ in the sidebar.

**Page header:** ‘Campaigns’ heading + ‘New Campaign’ button (primary, top right). Calls /campaigns/new.

**Campaign cards / table:** One row or card per campaign_briefs row for this org, ordered by created_at DESC.

| Column | Notes |
| --- | --- |
| Name | campaign name |
| Type | badge: Awareness \| Lead Gen \| Nurture \| Product Launch — each a distinct colour (indigo/green/amber/purple) |
| Status | badge: Draft (slate) \| Active (green) \| Paused (amber) \| Completed (slate-400) |
| Channel mix | icon row: LinkedIn / Email / Twitter / WhatsApp icons for each active channel |
| Prospects | numeric count of campaign_prospects rows |
| Copy progress | mini progress bar: approved outreach_copies / (prospects × channels). e.g. '14 / 30 copies approved' |
| Asset | thumbnail of the linked generation_jobs asset (or grey placeholder if no asset linked yet) |
| Created | relative date |
| Actions | ‘Open’ (link to /campaigns/[id]) — three-dot menu: Duplicate, Archive, Delete (with confirmation) |

**Filter bar (above table):** Status filter (All / Draft / Active / Completed) + Type filter (All / Awareness / Lead Gen / Nurture / Product Launch). Client-side filter, no re-fetch.

**Empty state:** ‘No campaigns yet. Create your first campaign to start generating personalised outreach.’ + ‘New Campaign’ button.

**Usage note:** A campaign is the container. Assets (/create) and prospects (/icp) are created independently and linked to a campaign from within /campaigns/[id] or /campaigns/new.


### 11.10 Campaign creation wizard (/campaigns/new)

Three-step wizard. Progress indicator at top (Step 1 of 3).

**Step 1 — Campaign basics:**
- Campaign name (required) — text input, max 120 chars
- Campaign type — 4 large visual cards (same card pattern as Section 17 of ui-design.instructions.md):
  | Card | Icon | Label | Sub-label |
  |---|---|---|---|
  | awareness | Megaphone | Awareness | Build brand visibility |
  | lead_gen | Target | Lead Gen | Convert new prospects |
  | nurture | Droplets | Nurture | Warm existing pipeline |
  | product_launch | Rocket | Product Launch | Announce something new |
- Description (optional) — textarea, max 500 chars
- Start date / End date (optional) — date pickers, shown inline side by side

**Step 2 — Channel mix and asset:**
- **Channel mix** — multi-select cards (toggle cards, can select multiple):
  | Card | Icon | Label | Sub-label |
  |---|---|---|---|
  | linkedin_message | LinkedIn icon | LinkedIn DM | Personal 1:1 outreach |
  | linkedin_post | LinkedIn icon | LinkedIn Post | Organic thought leadership |
  | email | Email icon | Email | Cold or warm email |
  | cold_dm | Chat icon | Cold DM | Twitter or Instagram DM |
- **Link an asset (optional):** Shows a mini grid of the org’s last 8 generation_jobs (image thumbnails). User clicks one to link it as the campaign’s creative asset. Or ‘Create new asset →’ link (navigates to /create with campaign_id as a query param so the created job auto-links back to this campaign after generation).

**Step 3 — Add prospects:**
- Shows the org’s existing prospects table (same component as /icp) with checkboxes. User selects which prospects to include in this campaign.
- ‘Import from ICP search’ shortcut: runs the ICP criteria from last_icp_criteria and adds all results above icp_score ≥ 0.6 to the campaign.
- ‘Skip for now — add prospects later’ link below the table.

On wizard completion: calls `create-campaign` then `add-campaign-prospects` (if prospects selected). Navigates to /campaigns/[id].


### 11.11 Campaign detail (/campaigns/[id])

The campaign’s workspace. Everything needed to run one campaign end-to-end.

**Page header:**
- Campaign name (editable inline on click)
- Type badge + Status badge (dropdown on click: Draft → Active → Completed)
- Date range display (if set) e.g. ‘Jun 1 – Jun 30, 2026’
- Channel mix icons
- Three-dot menu: Edit settings, Duplicate campaign, Archive

**Three main tabs:**

---

**Tab 1 — Content Calendar**

Renders the campaign’s `brief_data.posting_schedule` as a visual 14-day calendar grid.

Layout: 7 columns (Mon–Sun) × 2 rows (week 1, week 2). Each cell = one day. Days with scheduled posts show:
- Platform icon(s) for that day
- Caption preview (first 60 chars of the caption variant) in small text
- A ‘Copy’ icon to copy that day’s caption to clipboard

Empty cells show a ‘+’ button (no-op for now, with tooltip ‘Edit the brief to add posts here’).

Above calendar: best-time-to-post summary per channel (from brief_data.timing_recommendations). e.g. ‘LinkedIn: Tue/Thu 8–10am in your timezone’.

Hashtag panel below calendar: general hashtags (chips) + industry hashtags (chips) + regional hashtags (chips). Click a chip = copy to clipboard.

**If brief not yet generated:** shows a CTA card: ‘Generate your campaign brief to see the content calendar’ + ‘Generate Brief’ button (calls generate-campaign-brief with this campaign_id). Shows spinner + progress message during generation.

---

**Tab 2 — Prospects & Copy**

A table of all campaign_prospects for this campaign, with the outreach copy status per channel.

Table columns: Prospect name | Company | ICP Score | {one column per channel in channel_mix showing status chip: Not generated / Draft / Approved / Exported} | Actions

**Row actions:**
- Click row → opens a side drawer (not a new page) showing all outreach copies for this prospect across channels, in editable textareas. Same edit/approve/regenerate workflow as Section 11.8.
- Generate all missing — a bulk action above the table: generates outreach copy for every prospect–channel combination where status = ‘Not generated’. Calls personalise for each pair. Shows progress indicator.

**Batch actions bar (appears when rows are checked):**
- Approve selected — approves all checked rows’ draft copies (sets status=approved, approved_by, approved_at for each)
- Export selected — exports checked rows to CSV (same CSV format as Section 11.8 bulk export)
- Remove from campaign — deletes campaign_prospects rows (does not delete the prospect itself)

**Add prospects button:** ‘+ Add prospects’ above the table. Opens the org’s full prospect list in a modal with checkboxes. Calls add-campaign-prospects on confirm.

**Export full campaign CSV:**
Exports all approved outreach_copies for this campaign as one CSV:
- Columns: first_name, last_name, email, company_name, icp_score, platform, copy_text, campaign_name, campaign_type
- LinkedIn-formatted variant: a separate ‘Export for LinkedIn’ button produces a CSV with columns matching LinkedIn Campaign Manager import format (FirstName, LastName, EmailAddress, CompanyName, Message).

---

**Tab 3 — Brief & Assets**

**Left section — Creative asset:**
- If job linked: shows the asset image (or video thumbnail) at medium size. Click → navigates to /create/[job_id].
- ‘Change asset’ link: opens the mini grid of org’s last 8 jobs to pick a different one.
- If no asset: ‘No asset linked yet. Create an image or video first.’ + ‘Create asset’ button.

**Right section — Campaign brief PDF:**
- If brief generated: shows an in-app preview (embed the signed PDF URL in an `<iframe>` with `loading="lazy"` and `title="Campaign brief"`). Below the preview: Download PDF button (opens signed URL in a new tab). Regenerate Brief button (re-runs generate-campaign-brief; overwrites brief_data and pdf_url; shows confirmation dialog first).
- If brief not generated: ‘Generate Brief’ button. Shows what the brief will include: posting schedule, caption variants, hashtag sets, timing recommendations, prospect copy table. Quota note: ‘Generating a brief uses your text model quota. Estimated cost: ~0.02 USD per 100 prospects.’

> **NOTE:** The in-app PDF preview (iframe embed) only works in browsers that support PDF rendering. On mobile Safari, the iframe may not display. Always show the Download PDF button as the reliable fallback.

> **NOTE:** ‘Generate Brief’ on this tab and ‘Generate Brief’ on Tab 1 both call the same generate-campaign-brief Edge Function with `campaign_id`. The Edge Function is idempotent — it overwrites brief_data and pdf_url on the existing campaign_briefs row.

---

**Realtime updates:** Subscribe to a Supabase Realtime channel ‘campaign:{campaign_id}’. The generate-campaign-brief Edge Function broadcasts ‘brief_complete’ when PDF generation finishes. On receipt, refetch campaign data and switch Tab 3 from loading state to brief preview without a page reload.


---

## 12. ICP Discovery and Enrichment


### 12.1 ICP definition form (/icp)

- Target industries — multi-select
- Target company sizes — multi-select: SMB | Mid-market | Enterprise
- Target geographies — country multi-select
- Target job titles — free text tags, up to 10
- Company keywords — words that should appear in company description or sector
- Optional: specific company domains list — paste list of target company domains (one per line)
- 'Enrich' button — triggers icp-enrich Edge Function


### 12.2 Enrichment waterfall — PDL first (global coverage)

| Step | Source + free tier + what it fills |
| --- | --- |
| 1 — PDL | People Data Labs — 1000 records/month free. Best global coverage: India, SEA, ME, Africa, EU, US. Fills: name, email, title, company, LinkedIn URL, country, company size, industry. |
| 2 — Apollo | Apollo.io — 50 exports/month free. Strong US/EU. Fills any gaps from PDL for company and contact data. |
| 3 — Hunter | Hunter.io — 25 searches/month free. Email finder from domain. Fills email if missing after PDL and Apollo. |
| 4 — Clearbit | Clearbit Reveal — free company info from domain. Fills company-level gaps: size, industry, description. |
| 5 — Web scrape | Fallback. Scrape public LinkedIn profile URL (if available from steps 1-4), company website /about page, public Crunchbase profile. Used when steps 1-4 leave required fields empty. |

> **RULE:** If all enrichment steps are exhausted and some fields remain empty, save the partial prospect record with null values. NEVER fail or throw an error because enrichment is incomplete. Show partially enriched prospects with a badge indicating which fields are missing.


### 12.3 ICP Score Algorithm

After enrichment completes for each prospect, icp-enrich computes `icp_score` as a weighted percentage match against the submitted ICP criteria and stores it in prospects.icp_score.

Weights (total 100 when all criteria are set):

| Criterion | Weight | Match rule |
| --- | --- | --- |
| industries | 25 | prospect.industry is in criteria.industries list |
| titles | 25 | any string in criteria.titles appears (case-insensitive substring) in prospect.title |
| company_sizes | 20 | prospect.company_size is in criteria.company_sizes list |
| geographies | 20 | prospect.country is in criteria.geographies list |
| keywords | 10 | any keyword in criteria.keywords appears in prospect.company_name or company_description |

If a criterion is not set (null or empty array), its weight is excluded from both the score and the denominator. This ensures a partial criteria set still produces a meaningful 0.0–1.0 score.

Formula: `icp_score = matched_weight_sum / total_applicable_weight` (float, rounded to 2 decimal places)

Example: org sets only industries + titles (weight 50). Prospect matches both → icp_score = 1.0. Prospect matches industries only → icp_score = 0.5.

> **NOTE:** icp_score is recomputed on every enrichment run for a prospect. The last_icp_criteria used for scoring is saved to brand_contexts.last_icp_criteria so the /icp page can display the criteria that produced the current scores. Scores become stale if org changes criteria without re-running enrichment — the /icp page shows a Rescore button in that case (detected by comparing stored last_icp_criteria with current form values).


---

## 13. Payments — Dodo Payments

> **NOTE:** Dodo Payments replaces Stripe. Use Dodo Payments SDK or REST API. Verify that Dodo Payments supports metered/usage-based billing before starting Week 6. The webhook pattern is identical to Stripe.


### 13.1 Plan tiers

Two variants exist for each self-serve plan: **Platform Keys** (default, higher price — we absorb AI costs) and **BYOK** (client brings their own keys, lower price — they pay their AI provider directly). The `byok_mode` flag on the `orgs` row controls which mode the org is in. Dodo Payments has two product IDs per plan (platform and BYOK). The webhook sets both `plan_tier` and `byok_mode` when a subscription is created or updated.

| Plan | `byok_mode` | Price | Seats | Images/mo | Videos/mo | What's covered |
| --- | --- | --- | --- | --- | --- | --- |
| Starter Platform | false | $49/mo | 2 | 50 | 5 | Platform absorbs all AI API costs |
| Starter BYOK | true | $29/mo | 2 | 50 | 5 | Client pays their own AI provider directly |
| Growth Platform | false | $149/mo | 5 | 300 | 30 | Platform absorbs all AI API costs |
| Growth BYOK | true | $99/mo | 5 | 300 | 30 | Client pays their own AI provider directly |
| Scale Platform | false | $399/mo | 20 | Unlimited | 100 | Platform absorbs all AI API costs |
| Scale BYOK | true | $249/mo | 20 | Unlimited | 100 | Client pays their own AI provider directly |
| Fully Subscribed | N/A | Operator-set | Operator-set | Operator-set | Operator-set | Operator manages everything — no client keys ever |

> **NOTE:** Prices above are starting points — adjust in Dodo Payments dashboard without any code change. The `byok_mode` flag is what matters in code, not the price.
> **NOTE:** On BYOK plans, /settings/models shows a banner: 'You are on the BYOK plan — all AI costs are billed directly to your own API keys. Add your provider keys below to unlock generation.' The platform provides the product (prompts, pipelines, UI) but not the AI compute.


### 13.2 Webhook events

- subscription.created — set plan_tier, seat_limit, image_quota, video_quota on orgs row
- subscription.updated — update plan_tier and all limit fields
- subscription.cancelled — downgrade to starter tier, set effective end date
- invoice.paid — reset image_used=0 and video_used=0, set new quota_reset_at

> **RULE:** Verify Dodo Payments webhook HMAC signature before processing any event. Return HTTP 200 immediately after signature verification and process asynchronously to avoid timeout. Return HTTP 400 on signature failure.


---

## 14. Security Requirements


### 14.1 Authentication flow

1. User signs up with email + password via Supabase Auth UI component
2. Supabase sends verification email — user must verify before any access
3. On first login after signup: user is redirected to /create-org. The create-org Edge Function creates the org, makes the user owner, and sets the org_id JWT custom claim via app_metadata. On completion, user is redirected to /onboarding.
4. On org creation: INSERT into orgs, INSERT into org_members (role=owner, status=active), set org_id JWT custom claim via supabase.auth.admin.updateUserById app_metadata
5. Invite flow: owner/admin calls invite-user → Supabase inviteUserByEmail → invite-user INSERTs org_members row with status=pending → user clicks email link → Supabase Auth validates token → user is redirected to /invite/accept → page calls accept-invite Edge Function → org_members.status set to active + org_id JWT custom claim set


### 14.2 JWT custom claim setup

The org_id JWT custom claim must be set using a Supabase Auth hook (database webhook on auth.users INSERT or via the Supabase dashboard JWT template). Every Edge Function reads org_id exclusively from this claim.

```typescript
// In every Edge Function — mandatory first step
const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
const { data: { user } } = await supabase.auth.getUser(jwt)
const org_id = user?.app_metadata?.org_id  // from custom JWT claim
if (!org_id) return new Response(JSON.stringify({error:'unauthorized'}), {status:401})
```


### 14.3 Security rules

> **RULE:** API keys in org_api_keys: encrypt with AES-256-GCM using ENCRYPTION_KEY env var before every INSERT or UPDATE. Decrypt only inside Edge Functions. Never return decrypted values in any API response.
> **RULE:** LinkedIn / Apify scraped data: the raw Apify response must not be persisted in the signals table beyond 24 hours. The cleanup-apify-signals pg_cron job (Section 8) runs hourly and hard-deletes apify_linkedin signal rows older than 24h where status is not 'selected'. Only the normalised Signal fields (headline, url, summary) are kept in surviving rows. The enrichment_data JSONB column on signals must NOT be populated for apify_linkedin source rows — store only the normalised headline/url/summary.
> **RULE:** CORS: all Edge Functions must only accept requests from https://gtmengine.qubitlyventures.com and http://localhost:3000. Return HTTP 403 for any other origin.
> **RULE:** Supabase service role key must never appear in frontend code, browser environment variables (NEXT_PUBLIC_*), or Edge Function HTTP responses.
> **RULE:** Multi-provider key resolution in generate-asset: resolve via _shared/providers/router.ts resolveApiKey(orgId, providerKey). First read \orgs.byok_mode\ for the requesting org. Then: (1) Look up org_provider_api_keys for provider_key — AES-256-GCM decrypt if found — this always takes priority regardless of byok_mode. (2) **If byok_mode = true:** treat every provider as key_source=‘user_required’ — if no org key found, return HTTP 403 {error: ‘BYOK plan requires your own [Provider] API key. Add it in Settings → Model Settings.’}. Platform env vars are NEVER used as fallback when byok_mode=true. (3) **If byok_mode = false:** apply the model’s key_source setting — key_source=‘user_required’ and no org key → HTTP 403 {error: ‘This model requires your own [Provider] API key.’}; key_source=‘user_or_platform’ → use org key if present else platform env var; key_source=‘platform’ → always use platform env var. (4) Platform env vars: FAL_API_KEY / GOOGLE_AI_STUDIO_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENROUTER_DEFAULT_API_KEY. The decrypted key must never be logged, stored in generation_jobs, or returned in any API response.
> **RULE:** Seat enforcement: before invite-user creates an invite, it must SELECT COUNT(*) FROM org_members WHERE org_id = $1 and compare to orgs.seat_limit. If count >= limit, return HTTP 403 {error: 'seat_limit_reached'}.


---

## 15. Environment Variables


### 15.1 Cloudflare Pages — frontend (.env.local and Cloudflare Pages settings)

| Variable | Value |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon/public key — safe to expose |
| NEXT_PUBLIC_DODO_PUBLISHABLE_KEY | Dodo Payments publishable key |
| NEXT_PUBLIC_APP_URL | https://gtmengine.qubitlyventures.com |
| NEXT_PUBLIC_SENTRY_DSN | Sentry DSN for frontend error tracking |


### 15.2 Supabase Edge Functions (Supabase project secrets)

| Variable | Value |
| --- | --- |
| SUPABASE_URL | Supabase project URL (auto-available in Edge Functions) |
| SUPABASE_SERVICE_ROLE_KEY | Service role key — backend only, never expose to frontend |
| OPENROUTER_DEFAULT_API_KEY | Platform default OpenRouter key — used for models with key_source = ‘platform’ or ‘user_or_platform’ when org has no OpenRouter key |
| FAL_API_KEY | Platform default fal.ai key — used for fal models when key_source = ‘user_or_platform’ and org has no fal key. Set empty string if no platform fal key exists. |
| GOOGLE_AI_STUDIO_API_KEY | Platform default Google AI Studio key — used for Gemini/Veo models. Strongly recommended — Google AI Studio is the system default provider for most steps. |
| ANTHROPIC_API_KEY | Platform default Anthropic key — used for Claude models when key_source = ‘user_or_platform’ and org has no Anthropic key. |
| OPENAI_API_KEY | Platform default OpenAI key — used for GPT models and text-embedding-3-small (alternative embedding model). Not required for the brand_embedding default (perplexity/pplx-embed-v1-0.6b uses OPENROUTER_DEFAULT_API_KEY). |
| DODO_WEBHOOK_SECRET | Dodo Payments webhook signature secret for HMAC verification |
| RESEND_API_KEY | Resend API key for transactional email |
| ENCRYPTION_KEY | 32-byte random key for AES-256-GCM encryption of org_api_keys and org_provider_api_keys |
| SENTRY_DSN | Sentry DSN for Edge Function error reporting |
| APP_URL | https://gtmengine.qubitlyventures.com — used in email links |
| TAVILY_API_KEY | Platform Tavily Search API key — used as the data source key for fully_subscribed orgs. Not required for other plans (those orgs bring their own key via org_api_keys). If unset, Tavily signals are silently skipped for fully_subscribed orgs. |
| BRAVE_SEARCH_API_KEY | Platform Brave Search API key — used as the data source key for fully_subscribed orgs. Not required for other plans (those orgs bring their own key via org_api_keys). If unset, Brave Search signals are silently skipped for fully_subscribed orgs. |
| LANGFUSE_PUBLIC_KEY | Langfuse project public key — used by _shared/observability.ts to send generation traces from non-OpenRouter providers (fal.ai, Google AI Studio, Anthropic, OpenAI) to Langfuse via SDK. Found in Langfuse project Settings → API Keys. |
| LANGFUSE_SECRET_KEY | Langfuse project secret key — used alongside LANGFUSE_PUBLIC_KEY to authenticate SDK calls from Edge Functions. Never expose to frontend. |
| LANGFUSE_HOST | Langfuse host URL — set to https://cloud.langfuse.com for Langfuse Cloud, or your self-hosted Langfuse URL. Used by SDK in observability.ts. |
| PDL_API_KEY | People Data Labs API key — operator platform key for ICP enrichment (Step 1 of waterfall). Not per-org. If not set, PDL step is silently skipped and enrichment continues with Apollo. Free tier: 1000 records/month. |
| APOLLO_API_KEY | Apollo.io API key — operator platform key for ICP enrichment (Step 2 of waterfall). If not set, Apollo step is silently skipped. Free tier: 50 exports/month. |
| HUNTER_API_KEY | Hunter.io API key — operator platform key for email discovery (Step 3 of waterfall). If not set, Hunter step is silently skipped. Free tier: 25 searches/month. |
| CLEARBIT_API_KEY | Clearbit API key — operator platform key for company-level enrichment from domain (Step 4 of waterfall). If not set, Clearbit step is silently skipped. |
| OPERATOR_SECRET | Secret bearer token for the `operator-admin` Edge Function. Generate with `openssl rand -base64 32`. Must NOT be a user JWT. Must NOT start with `Bearer `. Stored as Supabase Edge Function secret only — never in frontend env or committed to git. Rotate this if compromised — all previous calls immediately rejected. |
| OPERATOR_USER_ID | Sentinel UUID used as `created_by` on `generation_jobs` rows created by `operator-admin create_campaign_job` action. Set to a fixed UUID that does not correspond to any real auth user. Allows filtering operator-created jobs in the DB. Set once at project creation. |


---

## 16. Project Folder Structure

```
gtm-engine/                                   # monorepo root
  apps/
    web/                                      # Next.js 14 frontend
      app/
        (public)/                             # unauthenticated routes
          page.tsx                            # / landing page
          login/page.tsx
          signup/page.tsx
          invite/accept/page.tsx
        (onboarding)/                         # post-signup flow
          create-org/page.tsx                 # org creation — shown after signup if no org exists
          onboarding/page.tsx                 # 5-section wizard
        (dashboard)/                          # protected routes
          layout.tsx                          # auth guard + onboarding check
          dashboard/page.tsx                  # trend feed
          dashboard/signal/[id]/page.tsx
          create/page.tsx                     # prompt editor
          create/[job_id]/page.tsx             # generation result
          icp/page.tsx
          icp/[prospect_id]/personalise/page.tsx
          campaigns/page.tsx
          settings/page.tsx
          settings/billing/page.tsx
          settings/team/page.tsx
          settings/models/page.tsx
          settings/usage/page.tsx
      components/
        ui/                                   # shadcn/ui base components
        brand/                                # onboarding wizard sections
        signals/                              # SignalCard, SignalFeed, FilterBar
        generation/                           # TagEditor, ModelSelector, JobProgress, AssetPreview
        icp/                                  # ICPForm, ProspectTable, EnrichmentStatus
        campaign/                             # CampaignBriefCard, OutreachCopyEditor
        layout/                               # AppShell, Sidebar, Header, UsageMeter
      lib/
        supabase/
          client.ts                           # browser Supabase client (singleton)
          server.ts                           # server-side Supabase client (App Router)
          types.ts                            # generated database types from supabase gen types
        models.config.ts                      # AI model definitions — only file to edit for new models
        constants.ts                          # country codes, industry list, timezone list, platform list
        utils.ts                              # formatting helpers, date utils
      store/
        org.store.ts                          # Zustand: current org, user, quota
        generation.store.ts                   # Zustand: active jobs, realtime subscription
  supabase/
    migrations/
      0001_initial_schema.sql                 # all tables
      0002_rls_policies.sql                   # all RLS policies
      0003_pgvector.sql                       # enable pgvector, add vector column
      0004_cron_jobs.sql                      # all pg_cron job definitions
      0005_model_seed.sql                     # model_providers + available_models seed data
      0006_usage_and_storage.sql              # llm_usage_events table + Storage bucket setup + RLS
    functions/
      ingest-signals/index.ts
      build-prompt/index.ts
      generate-asset/index.ts
      poll-job-status/index.ts
      check-quota/index.ts
      icp-enrich/index.ts
      personalise/index.ts
      generate-campaign-brief/index.ts
      dodopayments-webhook/index.ts
      invite-user/index.ts
      get-available-models/index.ts
      get-usage-stats/index.ts
      save-model-preferences/index.ts
      save-provider-keys/index.ts
      delete-provider-key/index.ts
      create-org/index.ts
      save-onboarding/index.ts
      update-org-settings/index.ts
      save-data-source-key/index.ts
      delete-data-source-key/index.ts
      remove-member/index.ts
      submit-feedback/index.ts
      accept-invite/index.ts
      get-upload-url/index.ts
      _shared/
        auth.ts                               # JWT validation, org_id extraction
        db.ts                                 # Supabase service client factory
        encryption.ts                         # AES-256-GCM encrypt/decrypt
        relevance.ts                          # TF-IDF scoring
        observability.ts                      # recordUsage() — llm_usage_events INSERT + Langfuse SDK trace
        providers/
          router.ts                           # routeGeneration() + resolveApiKey() — main dispatch
          openrouter.ts                       # OpenRouter API wrapper + live model list fetch
          fal.ts                              # fal.ai queue + polling wrapper
          google_ai_studio.ts                 # Gemini image/video/text via Google AI REST API
          anthropic.ts                        # Anthropic Messages API wrapper
          openai.ts                           # OpenAI Chat + Embeddings API wrapper
        sources/                              # one file per data source
          rss.ts | hackernews.ts | producthunt.ts | github.ts
          youtube.ts | reddit.ts | newsapi.ts | twitter.ts
          gdelt.ts | apify_linkedin.ts | regional.ts
        enrichment/                           # one file per enrichment source
          pdl.ts | apollo.ts | hunter.ts | clearbit.ts | web_scrape.ts
  .github/
    workflows/
      deploy.yml                              # on push to main: deploy frontend + supabase
  .env.local.example                          # template for local dev env vars
  README.md                                   # setup instructions for developer
```


---

## 17. Build Order — 6 Weeks

> **WARNING:** Build in strict week order. Do not start a later week until the previous week's end-of-week check passes. Do not add features from later weeks into earlier weeks.

Week 1 — Foundation
- Supabase project created. pgvector extension enabled in Supabase dashboard.
- Migration 0001: all tables from Section 4 created
- Migration 0002: all RLS policies from Section 4.12 applied
- Migration 0003: pgvector extension + vector column on brand_contexts
- Migration 0004: pg_cron job definitions from Section 8
- Migration 0005: model_providers and available_models seed data (all providers + all models from Section 7 seeded via migration 0005_model_seed.sql)
- Migration 0006: llm_usage_events table (Section 4.17) + its RLS policy (authenticated org members can SELECT own org rows; INSERT is service-role only). Create the three Supabase Storage buckets (brands, assets, briefs) with private access and per-org path RLS policies (Section 4.18).
- Supabase Auth: email+password, JWT custom claim for org_id configured via auth hook
- Next.js 14 project initialised with Tailwind + shadcn/ui, deployed to Cloudflare Pages
- Custom domain gtmengine.qubitlyventures.com live with HTTPS
- Auth pages: /signup, /login, /create-org, /invite/accept
- Edge Functions: create-org, accept-invite, get-upload-url
- Org creation flow: user creates org on first login via /create-org page calling create-org Edge Function, org_id JWT claim set via app_metadata
- Edge Function: save-onboarding (saves all 5 sections, triggers brand embedding on completion, extracts guidelines PDF text)
- Brand onboarding wizard: all 5 sections, data saved via save-onboarding Edge Function, onboarding_complete=true set on completion
- End-of-week test: sign up two users in different orgs. Verify cross-org RLS blocks all queries. Verify onboarding saves correctly. Verify domain resolves.

Week 2 — Signal ingestion and trend dashboard
- ingest-signals Edge Function: RSS, HackerNews, Product Hunt, GitHub source adapters
- regional.ts: auto-activation logic. Test with India, AU, US, Nigeria country codes.
- Custom source entry UI in /settings: validates and saves feed_config rows. Calls save-data-source-key and delete-data-source-key Edge Functions.
- Edge Function: update-org-settings (signal_ingestion_enabled toggle + frequency selector)
- Cron job: ingest-all-signals every 15 minutes
- Trend dashboard (/dashboard): signal cards, relevance sort, date/source filters, dismiss action, empty states, 'show dismissed' toggle
- End-of-week test: new user onboards with IN country code, within 15 minutes sees Indian regional signals scored by relevance. Dismiss one signal and verify soft delete.

Week 3 — Prompt editor and image generation
- build-prompt Edge Function: pgvector semantic lookup of brand context, ContentJob JSON assembly
- generate-asset Edge Function: multi-provider image model call via provider router, async job write, returns job_id
- poll-job-status Cron: checks pending jobs, saves asset to Storage, fires Realtime event
- check-quota Edge Function
- Tag editor UI (/create): form fields + bidirectional JSON toggle, brand context sidebar, model selector
- Edge Function: submit-feedback
- Generation result view (/create/[job_id]): image preview, download, feedback panel (calls submit-feedback), regenerate
- Realtime job progress on /dashboard and /create
- Usage meter in dashboard header
- End-of-week test: select a trend, generate an image, see it in under 3 minutes, rate it 3 stars, regenerate with one tag change, download both versions.

Week 4 — Video generation
- Extend generate-asset for video models (Veo 3.1, Kling) via provider router — supports OpenRouter, fal.ai, Google AI Studio
- Extend poll-job-status for long-running video jobs (up to 10 minutes, increase poll tolerance)
- Resend email: send completion notification when video job status changes to completed
- HTML5 video player in generation result view
- Model selector clearly groups Image vs Video with estimated time badges
- End-of-week test: submit video job, see job in progress on dashboard with live status, receive completion email, view video in browser, download MP4.

Week 5 — ICP, personalisation, campaign brief
- icp-enrich Edge Function: PDL → Apollo → Hunter → Clearbit → web scrape waterfall
- ICP definition form (/icp) with all criteria fields
- Prospect table: sortable, shows icp_score, enrichment_source, status badges, missing field indicators
- personalise Edge Function: brand voice + prospect data → outreach copy
- Outreach copy review page (/icp/[id]/personalise): copy edit, approve, export
- generate-campaign-brief Edge Function: posting schedule, captions per platform, hashtags, timezone-aware timing, PDF
- Campaign briefs page (/campaigns): list, download PDF
- End-of-week test: full pilot flow — onboard → trend → generate image → define ICP → enrich 3 prospects → personalise outreach → download campaign brief PDF.

Week 6 — Billing, polish, first users
- Dodo Payments integration: plan tiers, dodopayments-webhook Edge Function, quota updates
- Billing page (/settings/billing): plan display, usage meter, upgrade CTA
- Quota enforcement in generate-asset: HTTP 402 + upgrade modal in UI when over limit
- Team page (/settings/team): member list, invite form (seat limit check), remove member
- invite-user Edge Function: seat check, Supabase invite, org_members insert with status=pending
- remove-member Edge Function: member removal and role changes
- get-available-models, save-model-preferences, save-provider-keys, delete-provider-key Edge Functions: DB-driven model catalog, live OpenRouter merge for OpenRouter provider, per-provider key management
- Model preferences page (/settings/models): 7 step cards with multi-provider model dropdowns, recommendations carousel, per-provider key management sub-section, save + reset per step
- Error states: all Edge Function errors surfaced as user-friendly messages in UI (no raw error objects)
- Loading states: skeleton screens for all data-fetching pages
- Empty states: all pages have meaningful empty state with action CTA
- Sentry integration: frontend error boundary connected to Sentry
- README.md: local setup instructions, env var list, migration run order
- End-of-week test: complete billing flow, quota enforced, invite a second user, full end-to-end with real Dodo payment. Then get 3 paying users before building anything else.


---

## 18. Explicit Do-Not-Build List

The agent must not build any of the following, even if they seem like natural extensions of what is described:
- GTM steps 5 and 6: Nurture & Engage, Proposal Generator
- Direct posting to LinkedIn, Twitter, Instagram, or any social platform via their APIs
- Content calendar or visual scheduling UI
- CRM integrations of any kind
- Email campaign sending (only Resend transactional emails are allowed)
- iOS or Android mobile app
- Platform operator admin panel **UI** (the `operator-admin` Edge Function IS built — it provides programmatic access. A dedicated admin web UI is deferred to v2. Use Supabase Table Editor for direct DB ops.)
- Analytics or performance reporting dashboard
- A/B testing framework
- Real-time collaboration or multiplayer editing features
- Public REST or GraphQL API for third-party developers
- White-label or custom domain-per-org feature
- Fine-tuning, training, or RLHF on AI models
- Any third-party integration not explicitly named in this document
- Dark mode (build light mode only for v1 — do not invest time in theming infrastructure)


---

## 19. Key Decisions Log

These decisions were made intentionally. Do not reverse or work around them.

| Decision | Rationale |
| --- | --- |
| No FastAPI / no separate server | Supabase Edge Functions handle all API needs at pilot scale. No infrastructure to maintain for a small team. |
| Supabase Cron not APScheduler/Celery | pg_cron is native to Supabase, versioned in migrations, visible in dashboard, zero external infra. |
| Dodo Payments not Stripe | Client preference. Same webhook-driven pattern. Verify metered billing support before Week 6 starts. |
| LinkedIn via Apify not official API | Official LinkedIn API requires partner approval (months-long process). Apify provides equivalent public data for pilot. |
| PDL first in ICP waterfall not Apollo | PDL has superior global coverage for India, SEA, Africa, ME. Apollo is US/EU-centric. |
| Async for ALL generation jobs | Video takes 2-10 min. Building async from Week 3 (images) proves the pattern before video adds complexity in Week 4. |
| Soft delete for signals | Dismissed signal data feeds relevance scoring improvement over time. Hard delete destroys this signal. |
| org_id from JWT only, never request body | Prevents any cross-org access through request manipulation. Security enforced at auth layer. |
| Models DB-driven, not hardcoded | available_models table is the live source of truth for all selectable models across all providers. models.config.ts holds only TypeScript interfaces and the seed array for migration 0005. Operator adds, removes, or deactivates models directly in Supabase Table Editor — no code change needed. For OpenRouter, get-available-models merges the live API response so any new OpenRouter model appears immediately. All other providers are curated in the DB. User preferences in org_model_preferences take priority over system defaults. |
| RLS in migration 0002 not added later | Security enforced at database creation time. Never as a post-launch patch. |
| ICP enrichment: waterfall not parallel | Waterfall stops when fields are filled — avoids burning free tier quota on all sources for every prospect. |
| version + parent_job_id on generation_jobs | Enables regeneration history tracking and UX for comparing versions without duplicating full asset data. |
| DB + Langfuse SDK for all providers, not OTEL collector | llm_usage_events gives zero-infra DB queries and powers /settings/usage for client orgs. Langfuse SDK in observability.ts sends traces for fal.ai, Google AI Studio, Anthropic, and OpenAI; OpenRouter uses Broadcast. All cost KPIs for all clients are visible in one Langfuse project, filterable by userId=org_id. Full OTel pipeline is future scope that this design does not block. |
| fully_subscribed plan: operator-provided keys | On this plan the operator supplies all API keys centrally via platform env vars — both AI provider keys and data source keys (Tavily, Brave Search, etc.). Org users have no key entry UI at all. The operator decides which sources and providers to activate. This allows the operator to control quality, cost, and rate limits for fully managed accounts without exposing third-party credentials to the customer. |

---

## 20. Observability and Usage Tracking

Two audiences: (1) **Operator (you)** — needs cross-org cost visibility to understand platform profitability and per-client burn rate; (2) **Client orgs** — need to see their own AI token and cost consumption, especially when using their own provider API keys.

v1 is DB-native: no external collector required. OpenRouter Broadcast handles all OpenRouter call traces to Langfuse automatically at zero code cost. Other providers are tracked manually via llm_usage_events.


### 20.1 Strategy summary

| Concern | v1 Solution |
| --- | --- |
| Operator: per-org token and cost breakdown, all providers | Query llm_usage_events in Supabase Table Editor by org_id |
| Operator: OpenRouter traces with prompts, tokens, cost, latency | OpenRouter Broadcast → Langfuse — operator configures once in OpenRouter dashboard, zero code |
| Client org: see their own usage and estimated cost | get-usage-stats Edge Function + /settings/usage page |
| Operator: non-OpenRouter provider traces (fal.ai, Google AI Studio, Anthropic, OpenAI) in Langfuse | Langfuse SDK in _shared/observability.ts — sends one generation trace per API call tagged with userId=org_id. All providers visible in same Langfuse project alongside OpenRouter Broadcast traces. Filter by userId to see all cost KPIs for a specific client. |
| Future: per-org Langfuse project for client-facing trace access | Out of scope v1 — design space reserved in Section 20.5 |


### 20.2 OpenRouter Broadcast → Langfuse (operator setup — zero code in Edge Functions)

OpenRouter’s built-in Broadcast feature automatically forwards traces of every API call to configured observability platforms. No additional instrumentation code is needed in Edge Functions — just tag each call with org_id.

**What Broadcast sends automatically:** request messages, model output, prompt tokens, completion tokens, total tokens, cost, latency, model ID, provider name, tool usage.

**Operator one-time setup in OpenRouter dashboard:**
1. Settings → Observability → Enable Broadcast
2. Add Langfuse as a destination — provide Langfuse public key, secret key, and host URL
3. Set sampling rate to 1.0 (100% of traces captured)
4. Optionally enable Privacy Mode on the Langfuse destination to exclude prompt/completion content

**Per-client tagging (required in openrouter.ts):** Every OpenRouter API call must include these fields in the request body:

```json
{
  "user": "<org_id>",
  "session_id": "<job_id or ingest_run_id>",
  "trace": {
    "org_id": "<org_id>",
    "org_slug": "<org_slug>",
    "step_key": "<step_key>",
    "job_id": "<job_id or null>"
  }
}
```

In Langfuse, filter by `user = <org_id>` to see all OpenRouter traces for a specific client.

> **RULE:** Every call in openrouter.ts must pass user: orgId, session_id: jobId, and trace: {org_id, step_key, job_id} in the OpenRouter API request body. Omitting these means the operator cannot filter per-org in Langfuse.


### 20.3 Non-OpenRouter provider tracking (fal.ai, Google AI Studio, Anthropic, OpenAI)

These providers do not go through OpenRouter Broadcast. Each call is tracked in two places simultaneously via `recordUsage(supabase, langfuse, event)` in `_shared/observability.ts`:

**Track 1 — llm_usage_events DB row (powers /settings/usage page for client orgs)**

1. INSERTs one row into `llm_usage_events` using the Supabase service role client.
2. Calculates `estimated_cost_usd` from `available_models.cost_per_1k_input_tokens` + `cost_per_1k_output_tokens` if set: `estimated_cost_usd = (prompt_tokens / 1000 * cost_per_1k_input) + (completion_tokens / 1000 * cost_per_1k_output)`.

**Track 2 — Langfuse SDK generation trace (for operator cost reporting and per-client KPIs in Langfuse)**

3. Initialises a Langfuse SDK client using `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` from Edge Function secrets.
4. Creates a Langfuse trace with:
   - `userId: orgId` — the primary per-client filter in Langfuse
   - `sessionId: jobId` — links trace to the generation job or ingest run
   - `metadata: { org_id, org_slug, step_key, provider_key, key_source_used }`
5. Creates a generation span inside the trace with:
   - `model: modelId`, `modelParameters: { provider: providerKey }`
   - `usage: { promptTokens, completionTokens, totalTokens }` — feeds Langfuse cost dashboard
   - `input`: prompt text (or null for image/video models)
   - `output`: response text (or null for image/video models)
   - `startTime`, `endTime` — for latency tracking
   - `level: "ERROR"` and `statusMessage: errorCode` if `success=false`
6. Calls `await langfuse.shutdownAsync()` after every trace — required in Edge Function environments where no persistent process exists to flush the queue.

**Both tracks are fire-and-forget.** Each is wrapped in its own try/catch. A failed DB write or a failed Langfuse flush must never throw or affect the main provider response. Failures are logged to Sentry silently.

After this is wired up, all providers appear in the same Langfuse project: OpenRouter via Broadcast, and fal.ai / Google AI Studio / Anthropic / OpenAI via SDK. In Langfuse, filter by `userId = <org_id>` to see every AI call — across all providers — for a specific client. Use this for cost KPIs, latency analysis, error rate per provider, and per-step breakdown without any additional tooling.

> **RULE:** `recordUsage()` must be called in fal.ts, google_ai_studio.ts, anthropic.ts, and openai.ts — once per API response, on both success and failure. openrouter.ts does NOT call recordUsage — OpenRouter Broadcast handles all OpenRouter traces automatically.
> **NOTE:** If `LANGFUSE_PUBLIC_KEY` is not set, the Langfuse SDK portion is silently skipped — DB tracking via llm_usage_events continues unaffected. Set the env var to enable Langfuse tracing.
> **NOTE (Deno compatibility):** The Langfuse SDK is importable in Supabase Edge Functions via `import Langfuse from "npm:langfuse"`. The `await langfuse.shutdownAsync()` call is critical in Deno: Edge Functions have no persistent event loop to flush buffered events after the handler returns, so `shutdownAsync()` is the only mechanism that guarantees the trace is sent. Always place it in a `finally` block. Verify in local Supabase CLI dev environment before deploying.


### 20.4 Operator usage queries (Supabase Table Editor)

| Goal | SQL |
| --- | --- |
| Total estimated cost per org this month | `SELECT org_id, SUM(estimated_cost_usd) FROM llm_usage_events WHERE called_at >= date_trunc('month', now()) GROUP BY org_id ORDER BY 2 DESC` |
| Token burn per model across all orgs | `SELECT model_id, SUM(total_tokens), SUM(estimated_cost_usd) FROM llm_usage_events GROUP BY model_id` |
| Platform vs. org-key cost split per org | `SELECT org_id, key_source_used, COUNT(*), SUM(estimated_cost_usd) FROM llm_usage_events GROUP BY org_id, key_source_used` |
| Error rate per provider | `SELECT provider_key, COUNT(*) FILTER (WHERE success=false)::float / COUNT(*) AS error_rate FROM llm_usage_events GROUP BY provider_key` |

For OpenRouter specifically, Langfuse shows full prompt/completion traces filterable by user (org_id), model, date, and cost.


### 20.5 Future scope (explicitly deferred from v1)

- **Per-org Langfuse project:** Create a separate Langfuse project per client org via Langfuse API at org creation time. Client admins log into their own Langfuse project to view full traces with prompt/completion detail. Requires Langfuse provisioning in the org creation flow.
- **Monthly cost roll-up cron:** Nightly pg_cron job aggregates llm_usage_events into a usage_monthly_rollup table for fast dashboard queries at scale.
- **Budget alerts:** Resend email to org owner when estimated monthly cost crosses a configurable threshold stored on the org.
- **Image/video cost tracking:** Add cost_per_image and cost_per_video_second columns to available_models for accurate non-token-based cost estimation.
- **OTel Collector:** If other providers add OTLP support, consolidate all traces through a single OTel collector to remove per-provider manual recordUsage calls.


---

## 21. Operator Extensibility Reference

This section is the single source of truth for how the operator manages the platform **without code changes**. The guiding principle: anything that changes business configuration (models, pricing, limits, source toggles) is DB-driven. Only adding new *behaviour types* (new source adapters, new action types in operator-admin) requires code.

> **RULE:** The agent must not introduce hardcoded configuration that conflicts with the patterns in this section. All model IDs, default selections, quota values, and recommendation copy must flow from DB tables — not from source code constants.


### 21.1 Zero-code-change operations (Supabase Table Editor or operator-admin API)

The operator performs all of the following with direct DB edits (Table Editor) or calls to the `operator-admin` Edge Function. No code commit, no redeployment.

| Operation | Table | Action | Notes |
|---|---|---|---|
| **Add a new AI model** | `available_models` | INSERT row | Set `provider_key`, `model_id`, `model_label`, `model_type`, `compatible_step_keys`, `is_active=true`. No code change. |
| **Remove / hide a model** | `available_models` | Set `is_active=false` | Instantly hidden from all UI and selectors. History preserved. |
| **Change system default model** | `available_models` | Update `default_for_step_key` | Set to the step key string (e.g. `'image_generation'`). Clear old row's value. Only one row per step should be non-null. |
| **Update recommendation carousel** | `available_models` | Update `is_recommended`, `recommendation_text`, `recommendation_order` | Changes appear in UI immediately. Max 280 chars for `recommendation_text`. |
| **Toggle a provider on/off** | `model_providers` | Set `is_active=false` | Provider disappears from model selector and /settings/models immediately. |
| **Change model cost for billing estimates** | `available_models` | Update `cost_per_1k_input_tokens`, `cost_per_1k_output_tokens` | Powers estimated cost on /settings/usage. |
| **Set org to fully_subscribed plan** | `orgs` | Set `plan_tier='fully_subscribed'` | Hides all key entry UI for that org. Must also set all desired quotas. |
| **Switch org to BYOK pricing** | `orgs` | Set `byok_mode=true` | Platform keys no longer used as fallback. Banner shown in /settings/models. Update Dodo subscription to BYOK product separately. |
| **Switch org back to platform keys** | `orgs` | Set `byok_mode=false` | Platform keys resume as fallback for user_or_platform models. |
| **Update org plan/quotas/seats** | `orgs` | Update `plan_tier`, `seat_limit`, `image_quota`, `video_quota`, `byok_mode` | Or via `operator-admin` action `update_org`. Effective immediately. |
| **Reset org usage mid-cycle** | `orgs` | Set `image_used=0`, `video_used=0` | Or via `operator-admin` action `reset_org_usage`. |
| **Pause signal ingestion for an org** | `orgs` | Set `signal_ingestion_enabled=false` | Cron skips the org on next tick. Effective within 15 min. |
| **Enable/disable one data source** | `feed_configs` | Set `is_active=false` or `true` | Source adapter won't run on next cron tick. Or via `operator-admin` action `toggle_source`. |
| **Add a data source for an org** | `feed_configs` | INSERT row | Set `org_id`, `source_type`, `source_url`, `source_label`, `is_active=true`, `cron_expression`. Source must have an existing adapter file (see Section 21.3). |
| **Delete/change user role** | `org_members` | DELETE or UPDATE `role` | Or via `operator-admin` actions `delete_member`, `change_member_role`. |
| **Delete a user's auth account** | auth.users (Supabase dashboard) | Delete user | Or via `operator-admin` action `delete_member` with `delete_auth_user: true`. |
| **Create campaign asset for a client** | — | `operator-admin` action `create_campaign_job` | Operator provides `{org_id, signal_id, prompt_tags, model_id?, provider_key?}`. Service role context bypasses org isolation. Asset appears in client's generation_jobs and dashboard normally. |


### 21.2 One-file operations (add new source type)

Adding a **new signal source type** (a data provider not in the current 13) requires exactly **one new file** and **one registry line change** in `ingest-signals`. No schema changes, no migration, no other files.

**Step 1 — Create the adapter:**
```
supabase/functions/_shared/sources/{name}.ts
```
Implement the standard interface (`fetchSignals(feedConfig, apiKey): Promise<RawSignal[]>`). See sources.instructions.md.

**Step 2 — Register in ingest-signals:**
```typescript
// supabase/functions/ingest-signals/index.ts
import { fetchMyNewSource } from '../_shared/sources/my_new_source.ts'

const ADAPTER_REGISTRY: Record<string, SourceAdapter> = {
  rss:             fetchRSSFeed,
  hackernews:      fetchHackerNews,
  producthunt:     fetchProductHunt,
  github:          fetchGitHub,
  youtube:         fetchYouTube,
  reddit:          fetchReddit,
  newsapi:         fetchNewsAPI,
  twitter:         fetchTwitter,
  gdelt:           fetchGDELT,
  apify_linkedin:  fetchLinkedIn,
  tavily:          fetchTavily,
  brave_search:    fetchBraveSearch,
  regional_auto:   fetchRegionalSources,
  my_new_source:   fetchMyNewSource,  // ← add one line here
}
```

**Step 3 — Insert feed_config rows:**
```sql
INSERT INTO feed_configs (org_id, source_type, source_url, source_label, is_active)
VALUES ($1, 'my_new_source', $2, 'My New Source', true);
```

The registry dispatch loop in `ingest-signals` calls `ADAPTER_REGISTRY[feedConfig.source_type]` — if the key exists, the adapter runs. If the feed_config row specifies a `source_type` that has no registry entry, `ingest-signals` logs a warning and skips it safely.

> **RULE:** `ingest-signals` must use the ADAPTER_REGISTRY pattern — not a switch statement. A switch must be edited every time a new source is added; a registry object requires only one new key, isolated to the import section.


### 21.3 operator_audit_log table

Every `operator-admin` action is written to this table using the service role client. Migration: add in 0002 or a new migration `0007_operator_audit.sql`.

| Column | Type |
|---|---|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| action | text NOT NULL — e.g. `update_org`, `delete_member`, `create_campaign_job` |
| target_org_id | uuid REFERENCES orgs(id) — the org affected by this action |
| target_user_id | uuid — the user affected, if applicable |
| payload_summary | text — non-sensitive summary of the request (e.g. `plan_tier→fully_subscribed`) |
| created_at | timestamptz NOT NULL DEFAULT now() |

No RLS needed — this table is operator-only (read via Supabase Table Editor with service role).


### 21.4 "Create campaign for a client" flow (managed campaigns)

The operator uses the `operator-admin` Edge Function with `action: 'create_campaign_job'` to generate content on behalf of a client org without that client needing to log in.

**Request:**
```json
{
  "action": "create_campaign_job",
  "payload": {
    "org_id": "uuid-of-client-org",
    "signal_id": "uuid-of-trend-signal",       // optional — can be null
    "prompt_tags": {
      "subject": "...",
      "visual_style": "photography",
      "mood": "professional",
      "colour_palette": "#005FCC, #FFFFFF",
      "platform": "linkedin",
      "aspect_ratio": "4:5",
      "cta_text": "Book a demo →",
      "negative_prompt": "",
      "additional_notes": ""
    },
    "model_id": "fal-ai/nano-banana-2",        // optional — falls back to org preference / system default
    "provider_key": "fal"                       // optional — required if model_id is provided
  }
}
```

**operator-admin behaviour:**
1. Verifies `OPERATOR_SECRET` auth header.
2. Fetches the org's `brand_contexts` row using service role client.
3. Calls `build-prompt` HTTP endpoint passing org_id (service role bypasses org isolation — the call acts as that org's context).
4. Calls `generate-asset` HTTP endpoint with the assembled ContentJob, also passing org_id override.
5. The resulting `generation_jobs` row is owned by `org_id` (the client org).
6. Returns `{success: true, job_id: "..."}`.

The client org sees the asset in their `/dashboard` and `/create/[job_id]` view exactly as if they had generated it themselves. The `created_by` field on `generation_jobs` is set to a special operator sentinel UUID (store in env var `OPERATOR_USER_ID`) so the org's usage dashboard can distinguish operator-created jobs from user-created jobs.


### 21.5 Modular architecture decision log

| Decision | Why |
|---|---|
| ADAPTER_REGISTRY not switch | Switch requires touching the dispatch function for every new source. Registry only requires adding one import + one key. Old adapters are never touched. |
| operator-admin as Edge Function not Admin UI | Admin UI is out of scope for v1. An HTTP API callable from curl, Postman, or a future thin admin UI gives equivalent power with zero frontend cost. |
| operator_audit_log | Operator actions bypass RLS and are high-trust. Audit trail is required for compliance and debugging. |
| create_campaign_job via service role | The operator owns the platform — service role context is correct for cross-org actions. The client org's brand context, preferences, and quota rules are still respected (build-prompt fetches their brand_contexts; quota is NOT bypassed for normal asset generation — only the org isolation check is bypassed). |
| Quotas still enforced for create_campaign_job | Operator-created jobs consume client org quota. This is intentional — if the operator needs to exempt a job from quota, they `reset_org_usage` first. |
Version 1.0 — Build only what is written here — gtmengine.qubitlyventures.com
