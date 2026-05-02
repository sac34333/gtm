---
description: "Week 1 — Foundation: DB schema, Auth, 4 Edge Functions, onboarding wizard. Complete full Week 1 build end-to-end."
agent: agent
tools: [supabase]
---

# Week 1 — Foundation

Read the master spec at [gtm.md](../../gtm.md) before writing any code. Do not add anything not in the spec.

## STOP CHECK
Before starting: verify the Supabase project exists and pgvector + pg_cron are enabled:
- Call `list_extensions` — if `vector` or `pg_cron` are missing, call `execute_sql`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  ```

---

## PART 1 — Database Migrations (use Supabase MCP `apply_migration`)

### Migration 0001_initial_schema
Create all 17 tables from spec Section 4. Apply using `apply_migration('0001_initial_schema', sql)`.

Tables to create (all must have `uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `timestamptz` timestamps, `ON DELETE CASCADE` on org_id FKs):
- `orgs` — all columns from Section 4.1 including: `signal_ingestion_enabled boolean NOT NULL DEFAULT false`, `signal_ingestion_frequency text NOT NULL DEFAULT 'daily'`, `last_signal_ingestion_at timestamptz`, `plan_tier text NOT NULL DEFAULT 'starter'`, `seat_limit integer NOT NULL DEFAULT 2`, `image_quota integer NOT NULL DEFAULT 50`, `video_quota integer NOT NULL DEFAULT 5`, `image_used integer NOT NULL DEFAULT 0`, `video_used integer NOT NULL DEFAULT 0`, `quota_reset_at timestamptz`, `dodo_customer_id text`, `dodo_subscription_id text`, `onboarding_complete boolean NOT NULL DEFAULT false`
- `org_members` — with UNIQUE(org_id, user_id), `status text NOT NULL DEFAULT 'active'` (values: 'pending' | 'active'), `role text NOT NULL` (values: 'owner' | 'admin' | 'member')
- `brand_contexts` — UNIQUE(org_id), all columns from Section 4.3. `brand_context_embedding` column is added in migration 0003, NOT here. `last_icp_criteria jsonb`, `brand_guidelines_text text`
- `feed_configs` — all columns from Section 4.4
- `org_api_keys` — all columns from Section 4.5. `encrypted_value text NOT NULL` (never plaintext)
- `signals` — all columns from Section 4.6. `url_hash text NOT NULL`, UNIQUE(org_id, url_hash)
- `generation_jobs` — all columns from Section 4.7. `provider_key text NOT NULL`, `poll_count integer NOT NULL DEFAULT 0`, `version integer NOT NULL DEFAULT 1`, `parent_job_id uuid REFERENCES generation_jobs(id)`
- `generation_feedback` — all columns from Section 4.8
- `prospects` — all columns from Section 4.9. `company_description text` (nullable)
- `outreach_copies` — all columns from Section 4.10
- `campaign_briefs` — all columns from Section 4.11
- `org_model_preferences` — all columns from Section 4.12. UNIQUE(org_id, step_key)
- `model_providers` — all columns from Section 4.13
- `available_models` — all columns from Section 4.14. UNIQUE(provider_key, model_id)
- `org_provider_api_keys` — all columns from Section 4.15. UNIQUE(org_id, provider_key). `encrypted_key text NOT NULL`

### Migration 0002_rls_policies
Apply using `apply_migration('0002_rls_policies', sql)`.

Apply this exact 4-policy RLS pattern (Section 4.16) to EVERY table with an `org_id` column:
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON <table> FOR SELECT USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
CREATE POLICY "org_isolation_insert" ON <table> FOR INSERT WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);
CREATE POLICY "org_isolation_update" ON <table> FOR UPDATE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
CREATE POLICY "org_isolation_delete" ON <table> FOR DELETE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
```
Tables to apply this to: orgs, org_members, brand_contexts, feed_configs, org_api_keys, signals, generation_jobs, generation_feedback, prospects, outreach_copies, campaign_briefs, org_model_preferences, org_provider_api_keys.

`model_providers` and `available_models` have no `org_id` — apply read-only RLS:
```sql
ALTER TABLE model_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON model_providers FOR SELECT USING (true);
ALTER TABLE available_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON available_models FOR SELECT USING (true);
```

After applying, run: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` — every table must show `rowsecurity = true`.

### Migration 0003_pgvector
Apply using `apply_migration('0003_pgvector', sql)`.

**CRITICAL WARNING from spec:** The vector dimension must match the output of the embedding model. The default embedding model is `perplexity/pplx-embed-v1-0.6b` via OpenRouter. Call `search_docs` with "pgvector vector dimensions perplexity pplx-embed-v1" to verify. If output is 1536 dims use `vector(1536)`. If 1024 dims use `vector(1024)`. OpenAI text-embedding-3-small is confirmed 1536-dim (use as reference if uncertain).

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE brand_contexts ADD COLUMN IF NOT EXISTS brand_context_embedding vector(1536); -- verify dimension first
CREATE INDEX ON brand_contexts USING ivfflat (brand_context_embedding vector_cosine_ops) WITH (lists = 100);
```

### Migration 0004_cron_jobs
Apply using `apply_migration('0004_cron_jobs', sql)`.

All jobs call Edge Functions via HTTP POST with service role key. Note: pg_cron minimum is 1 minute — for poll-generation-jobs use 1 minute (spec says 30s but pg_cron cannot go below 1 min, document this in code comment).

```sql
SELECT cron.schedule('ingest-all-signals', '*/15 * * * *', $$
  SELECT net.http_post(url:='https://<PROJECT_REF>.supabase.co/functions/v1/ingest-signals',
    headers:='{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb) AS request_id
$$);

SELECT cron.schedule('poll-generation-jobs', '* * * * *', $$
  SELECT net.http_post(url:='https://<PROJECT_REF>.supabase.co/functions/v1/poll-job-status',
    headers:='{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb) AS request_id
$$);

SELECT cron.schedule('reset-monthly-quotas', '0 0 1 * *', $$
  SELECT net.http_post(url:='https://<PROJECT_REF>.supabase.co/functions/v1/reset-monthly-quotas',
    headers:='{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb) AS request_id
$$);

SELECT cron.schedule('archive-old-signals', '0 2 * * *', $$
  SELECT net.http_post(url:='https://<PROJECT_REF>.supabase.co/functions/v1/archive-old-signals',
    headers:='{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb) AS request_id
$$);

SELECT cron.schedule('cleanup-apify-signals', '0 * * * *', $$
  SELECT net.http_post(url:='https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-apify-signals',
    headers:='{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb) AS request_id
$$);
```
Note: Replace `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>` with actual values from Supabase project settings.

### Migration 0005_model_seed
Apply using `apply_migration('0005_model_seed', sql)`.

Seed `model_providers` (5 rows):
- `openrouter` — OpenRouter — https://openrouter.ai/api/v1 — models_endpoint: https://openrouter.ai/api/v1/models — platform_key_available: true
- `fal` — fal.ai — https://fal.run — platform_key_available: false
- `google_ai_studio` — Google AI Studio — https://generativelanguage.googleapis.com — platform_key_available: true
- `anthropic` — Anthropic — https://api.anthropic.com — platform_key_available: false
- `openai` — OpenAI — https://api.openai.com — platform_key_available: false

Seed `available_models` with ALL models from spec Sections 7.1, 7.2, and 7.3. Key entries:
- `google/gemini-3.1-flash-image-preview` (openrouter, image, default_for_step_key='image_generation', cost_tier='mid', key_source='user_or_platform', is_recommended=true, recommendation_order=2)
- `fal-ai/nano-banana` (fal, image, cost_tier='cheap', key_source='user_required', is_recommended=true, recommendation_order=1)
- `veo-3.1-generate-preview` (google_ai_studio, video, default_for_step_key='video_generation', cost_tier='premium', key_source='user_required', is_recommended=true, recommendation_order=4)
- `gemini-3-flash-preview` (google_ai_studio, text, default_for_step_key multiple: 'prompt_assembly','relevance_scoring','outreach_copy','campaign_brief', cost_tier='cheap', key_source='user_or_platform', is_recommended=true, recommendation_order=6)
- `perplexity/pplx-embed-v1-0.6b` (openrouter, embedding, default_for_step_key='brand_embedding', cost_tier='cheap', key_source='platform')
- All other models from spec Section 7 — none are system defaults but all are is_active=true

Use `INSERT ... ON CONFLICT (provider_key, model_id) DO NOTHING`.

### Migration 0006_usage_and_storage
Apply using `apply_migration('0006_usage_and_storage', sql)`.

Create `llm_usage_events` table (Section 4.17). Then apply RLS:
```sql
ALTER TABLE llm_usage_events ENABLE ROW LEVEL SECURITY;
-- Org members can only read their own org's rows
CREATE POLICY "org_read_own" ON llm_usage_events FOR SELECT USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
-- INSERT only via service role (no policy = service role bypasses RLS; authenticated users cannot insert)
```

Create Storage buckets:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('brands', 'brands', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('briefs', 'briefs', false) ON CONFLICT DO NOTHING;
```

Apply per-org path isolation on storage.objects for all 3 buckets (SELECT only — INSERT/UPDATE/DELETE are service-role-only):
```sql
CREATE POLICY "org_storage_select_brands" ON storage.objects FOR SELECT
  USING (bucket_id = 'brands' AND (storage.foldername(name))[1] = (
    SELECT org_id::text FROM org_members WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "org_storage_select_assets" ON storage.objects FOR SELECT
  USING (bucket_id = 'assets' AND (storage.foldername(name))[1] = (
    SELECT org_id::text FROM org_members WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "org_storage_select_briefs" ON storage.objects FOR SELECT
  USING (bucket_id = 'briefs' AND (storage.foldername(name))[1] = (
    SELECT org_id::text FROM org_members WHERE user_id = auth.uid() LIMIT 1));
```

After all migrations: call `generate_typescript_types` and save output to `apps/web/lib/supabase/types.ts`.

---

## PART 2 — Shared Utilities

Create all files in `supabase/functions/_shared/`:

### auth.ts
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

export async function validateJWT(req: Request) {
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) throw new Response(JSON.stringify({error: 'unauthorized'}), {status: 401})
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) throw new Response(JSON.stringify({error: 'unauthorized'}), {status: 401})
  return user
}

export function extractOrgId(user: any): string {
  const org_id = user?.app_metadata?.org_id
  if (!org_id) throw new Response(JSON.stringify({error: 'unauthorized'}), {status: 401})
  return org_id
}

export function requireRole(user: any, minRole: 'member' | 'admin' | 'owner') {
  const roleHierarchy = { member: 0, admin: 1, owner: 2 }
  const userRole = user?.app_metadata?.role as 'member' | 'admin' | 'owner'
  if (!userRole || roleHierarchy[userRole] < roleHierarchy[minRole]) {
    throw new Response(JSON.stringify({error: 'insufficient_role'}), {status: 403})
  }
}
```

### db.ts
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from './types.ts'

export function createServiceClient() {
  return createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

export function createUserClient(jwt: string) {
  return createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  )
}
```

### encryption.ts
Full AES-256-GCM encrypt/decrypt using Web Crypto API (available in Deno):
```typescript
export async function encrypt(plaintext: string, key: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(key.padEnd(32).slice(0, 32))
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, cryptoKey, new TextEncoder().encode(plaintext))
  const combined = new Uint8Array([...iv, ...new Uint8Array(encrypted)])
  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(ciphertext: string, key: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(key.padEnd(32).slice(0, 32))
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt'])
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, cryptoKey, data)
  return new TextDecoder().decode(decrypted)
}
```

### relevance.ts
TF-IDF scoring — `scoreRelevance(headline: string, summary: string, themes: string[], keywords: string[]): number`. Returns 0.0–1.0. Use term frequency normalization. All logic is pure TypeScript — no AI model call.

### observability.ts
`recordUsage(supabase, event): Promise<void>` — INSERTs to `llm_usage_events`. Also calls Langfuse SDK (import `Langfuse from 'npm:langfuse'`) if `LANGFUSE_PUBLIC_KEY` is set. Both tracks fire-and-forget, each in their own try/catch. Call `await langfuse.shutdownAsync()` in finally block (required in Deno — no persistent event loop).

### providers/router.ts
`resolveApiKey(supabase, orgId: string, providerKey: string, keySource: string): Promise<string>` — key resolution per Section 14 rules. `routeGeneration(providerKey, modelId, payload, apiKey): Promise<any>` — dispatches to correct provider adapter.

### providers/openrouter.ts
`callOpenRouter(modelId, messages, opts, apiKey, orgId, orgSlug, jobId, stepKey)` — every call must include `user: orgId, session_id: jobId, trace: {org_id: orgId, org_slug: orgSlug, step_key: stepKey, job_id: jobId}` in request body (for OpenRouter Broadcast → Langfuse per spec Section 20.2). Does NOT call `recordUsage`.

Create stub files for remaining providers (full implementation in later weeks):
- `providers/fal.ts`, `providers/google_ai_studio.ts`, `providers/anthropic.ts`, `providers/openai.ts`

---

## PART 3 — Edge Functions

Create each at `supabase/functions/<name>/index.ts`. Standard CORS origins: `https://gtmengine.qubitlyventures.com` and `http://localhost:3000` ONLY — return HTTP 403 for any other origin.

### create-org
POST — authenticated user with no existing org_members row.
- Accepts `{name: string, slug: string}`
- Validate: slug matches `/^[a-z0-9-]{3,30}$/`, unique in orgs table → HTTP 409 if not unique
- If user already has an org_members row → HTTP 409 `{error: 'org_already_exists'}`
- INSERT into orgs (plan_tier='starter', seat_limit=2, image_quota=50, video_quota=5, image_used=0, video_used=0, signal_ingestion_enabled=false, onboarding_complete=false)
- INSERT into org_members (role='owner', status='active')
- Call `supabase.auth.admin.updateUserById(userId, {app_metadata: {org_id, role: 'owner'}})` using SERVICE role client
- Returns `{org_id, slug}`

### accept-invite
POST — authenticated user who just confirmed their invite link.
- No request body needed
- Look up `org_members WHERE user_id = auth_user_id AND status = 'pending'`
- If not found → HTTP 404 `{error: 'no_pending_invite'}`
- Update status to 'active'
- Call `supabase.auth.admin.updateUserById(userId, {app_metadata: {org_id, role}})` using SERVICE role client
- Returns `{success: true, org_id, onboarding_complete}`

### get-upload-url
POST — any authenticated org member.
- Accepts `{bucket: string, path: string, content_type: string}`
- Validate: `bucket` MUST be `"brands"` only — reject any other bucket with HTTP 403
- Validate content_type is one of: `image/png, image/jpeg, image/svg+xml, application/pdf, image/webp` — reject others with HTTP 400
- Build full path: `{org_id}/{path}` (org_id comes from JWT, NOT request body)
- Call `supabase.storage.from('brands').createSignedUploadUrl(fullPath)` using SERVICE role client
- Signed URL expires in 60 seconds
- Returns `{signed_url, path, token}`

### save-onboarding
POST — any authenticated org member.
- Accepts full brand_contexts payload + optional `{complete: boolean}` flag
- UPSERT brand_contexts (one row per org) with all provided fields
- If `complete=true`:
  - Set `orgs.onboarding_complete = true`
  - Extract text from guidelines PDF if `brand_guidelines_url` is set: use `npm:pdfjs-dist/legacy/build/pdf.js` with `GlobalWorkerOptions.workerSrc = ''`. If extraction fails for any reason → set `brand_guidelines_text = null`, NEVER reject the save
  - Generate brand context embedding: concatenate `company_name + ' ' + one_sentence_pitch + ' ' + extended_description + ' ' + active_themes.join(' ') + ' ' + decision_maker_titles.join(' ')` → call the embedding model (default: `perplexity/pplx-embed-v1-0.6b` via OpenRouter). Resolve model from `org_model_preferences` for `step_key='brand_embedding'` first, fall back to `available_models` default. If embedding fails → catch silently, NEVER block the save
- Returns `{saved: true, onboarding_complete: boolean}`

Deploy all 4 functions using `deploy_edge_function` MCP tool. Verify with `get_logs`.

---

## PART 4 — Next.js Frontend

Initialize the project at `apps/web/`:
```bash
npx create-next-app@14 apps/web --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd apps/web
npx shadcn@latest init  # choose: Default style, Slate base color, CSS variables yes, dark mode: class
# After init: apply the full CSS variable overrides from ui-design.instructions.md §1 to app/globals.css
# Set <html className={`${inter.variable} font-sans dark`}> in app/layout.tsx (dark class always on — no toggle)
# Install Inter font via next/font/google as specified in ui-design.instructions.md §2
```

Install additional packages:
```bash
npm install @supabase/supabase-js@^2 @supabase/ssr@^0 @tanstack/react-query@^5 zustand@^5
npm install @sentry/nextjs@^8
```

### File structure to create:
- `apps/web/lib/supabase/client.ts` — browser Supabase client singleton
- `apps/web/lib/supabase/server.ts` — server-side Supabase client using `@supabase/ssr`
- `apps/web/lib/supabase/types.ts` — generated types from MCP `generate_typescript_types`
- `apps/web/middleware.ts` — Supabase auth session refresh middleware
- `apps/web/store/org.store.ts` — Zustand store: `{user, org, quotas, setOrg, setQuotas}`

### Auth guard layout
`apps/web/app/(dashboard)/layout.tsx`:
1. Call `createSupabaseServer().auth.getUser()` — redirect to /login if no user
2. Check `user.app_metadata.org_id` — redirect to /create-org if missing
3. Check `orgs.onboarding_complete` — redirect to /onboarding if false
4. Render children inside `<AppShell>` (sidebar + header)

### Pages to create for Week 1:
- `app/(public)/page.tsx` — landing page: value prop, feature highlights, pricing table (Starter $49/Growth $149/Scale $399), login/signup CTAs
- `app/(public)/signup/page.tsx` — Supabase Auth email+password signup. On success → `/create-org`
- `app/(public)/login/page.tsx` — login. On success: check onboarding_complete, redirect to /onboarding or /dashboard
- `app/(onboarding)/create-org/page.tsx` — 2 fields: company name + slug. Calls create-org Edge Function. Validates slug client-side: `/^[a-z0-9-]{3,30}$/`. On success → /onboarding
- `app/(public)/invite/accept/page.tsx` — calls accept-invite Edge Function on mount. Shows loading → success redirect to /onboarding (if first login) or /dashboard
- `app/(onboarding)/onboarding/page.tsx` — 5-section wizard. Progress bar (1 of 5). Saves each section via save-onboarding Edge Function. Section 5 file uploads use get-upload-url → PUT directly to Supabase Storage (browser → Storage, NOT via Edge Function proxy). On section 5 submit with `complete=true` → redirect to /dashboard.

### Onboarding sections (exact fields from spec Section 10):
**Section 1:** company_name*, country_code* (ISO dropdown), industry_sector* (dropdown), company_size*, website_url, founding_year, one_sentence_pitch* (max 200 chars), extended_description, products_services (up to 5 {name, description}), revenue_model, target_geographies (multi-select), target_industries (multi-select), target_company_sizes (multi-select: SMB/Mid-market/Enterprise), decision_maker_titles (tag input, up to 5)
**Section 2:** 5 tone sliders (0-100), sentence_length, jargon_level, emoji_usage, cta_style, voice_examples (up to 3 text areas — label them as the most important input)
**Section 3:** brand_colours (3 hex pickers), logo upload (5MB max, image/png|jpeg|svg+xml), brand_guidelines PDF (20MB max), reference_images (up to 5, 10MB each), anti_reference_images (up to 3), visual_style, dark_light_preference, busy_minimal, human_faces, location_style
**Section 4:** active_themes (up to 3), competitor_names (up to 10), primary_platform, secondary_platform, posts_per_week, timezone (IANA picker, auto-detected from country_code), topics_to_avoid, phrases_to_avoid, visual_styles_to_avoid, sensitivities
**Section 5:** Reddit API (client_id + secret), LinkedIn/Apify token (opt-in checkbox + disclaimer), Twitter bearer, NewsAPI key, Tavily API key, Brave Search API key, AI provider keys (OpenRouter, fal.ai, Google AI Studio, Anthropic, OpenAI), Clearbit key, YouTube API key, custom data sources text area

> **NOTE:** When plan_tier = 'fully_subscribed', ALL key entry fields in Section 5 are hidden. Show a banner: 'Your plan includes platform-managed integrations.'

---

## PART 5 — Verification

Run the end-of-week test:
1. `list_tables` — verify all 17 tables present
2. `list_migrations` — verify 0001–0006 all recorded
3. `execute_sql`: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` — all must show `rowsecurity = true`
4. Cross-org RLS test: create two test users in different orgs, attempt SELECT from each other's org data — must return 0 rows
5. Check `get_logs` for all 4 deployed Edge Functions — no startup errors

**End-of-week test (spec Section 17):** Sign up two users in different orgs. Verify cross-org RLS blocks all queries. Verify onboarding saves correctly. Verify domain resolves.
