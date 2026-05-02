---
description: "Week 6 — Billing, team management, model settings, observability, Sentry, and README. Full polish and first paying users."
agent: agent
tools: [supabase]
---

# Week 6 — Billing, Polish, and First Users

Read the master spec at [gtm.md](../../gtm.md) Sections 5, 7, 11.6, 11.7, 13, 15, 20. Weeks 1–5 must be complete and the Week 5 end-of-week pilot flow test must pass.

## STOP CHECK
Run the full Week 5 pilot flow test. All steps must complete successfully. Then check `get_logs` across all functions — resolve any persistent errors before proceeding.

> **CRITICAL NOTE from spec Section 13:** Verify that Dodo Payments supports metered/usage-based billing before building the billing integration. Call `search_docs` with "dodo payments subscription metered billing webhook" to confirm webhook event names match those in spec Section 13.2.

---

## PART 1 — 7 New Edge Functions

### invite-user
POST — owner/admin only. `requireRole(user, 'admin')`.
- Accepts `{email: string, role: 'admin' | 'member'}`
- **Seat check first**: `SELECT COUNT(*) FROM org_members WHERE org_id = $org_id AND status IN ('active', 'pending')`. If count >= orgs.seat_limit → HTTP 403 `{error: 'seat_limit_reached'}`
- Call `supabase.auth.admin.inviteUserByEmail(email, {data: {org_id, invited_role: role}})` using SERVICE role client
- UPSERT into `org_members` (INSERT ... ON CONFLICT (org_id, user_id) DO UPDATE SET status='pending', role=$role): status='pending', role, invited_by=user.id
- Returns `{invited: true, email}`

### remove-member
POST — owner or admin. `requireRole(user, 'admin')`.
- Accepts `{user_id: string, action: 'remove' | 'change_role', new_role?: 'admin' | 'member'}`
- Admin cannot remove or demote owner: check target's role — if 'owner' and caller is 'admin' → HTTP 403 `{error: 'cannot_modify_owner'}`
- For `action = 'remove'`:
  - Validate at least 1 owner remains: `SELECT COUNT(*) FROM org_members WHERE org_id = $org_id AND role = 'owner'` — if target is owner and count <= 1 → HTTP 403 `{error: 'cannot_remove_last_owner'}`
  - DELETE from org_members using SERVICE role client
- For `action = 'change_role'`:
  - Only owner can do this: `requireRole(user, 'owner')`
  - UPDATE org_members SET role=$new_role
- Returns `{success: true}`

### get-available-models
GET — any authenticated org member.
- Returns all `available_models WHERE is_active = true` grouped by `provider_key` and `model_type`
- For OpenRouter ONLY: if org has a key in `org_provider_api_keys` for 'openrouter', additionally call `https://openrouter.ai/api/v1/models` using that decrypted key. Merge live results with DB catalog — DB records take priority; any live model not in DB is appended.
- For all other providers: DB catalog only.
- Also fetch `org_model_preferences WHERE org_id = $org_id` — include current preferences in response.
- Also fetch provider key status per provider: for each active provider, check if org has a key in `org_provider_api_keys` (return `has_org_key: boolean`) and if `model_providers.platform_key_available = true`.
- **Cache in Edge Function memory** for 10 minutes per org (use a module-level Map with `{org_id: {data, timestamp}}`).
- Returns:
  ```typescript
  {
    providers: Array<{provider_key, display_name, models: AvailableModel[], has_org_key: boolean, platform_key_available: boolean}>,
    recommended: Array<{model_id, provider_key, model_label, recommendation_text, recommendation_order, is_recommended}>,
    preferences: Array<{step_key, provider_key, model_id, model_label}>,  // current org preferences
    cached_at: string  // ISO timestamp
  }
  ```

### save-model-preferences
POST — admin/owner only. `requireRole(user, 'admin')`.
- Accepts `{preferences: Array<{step_key, provider_key, model_id, model_label}>}`
- For each preference: validate `(provider_key, model_id)` exists in `available_models` with `is_active = true`. Validate `compatible_step_keys` includes the `step_key`. If invalid → add to errors array, do not save that row.
- Valid rows: UPSERT into `org_model_preferences` (INSERT ... ON CONFLICT (org_id, step_key) DO UPDATE)
- Returns `{saved: step_key[], errors: Array<{step_key, reason}>}`

### save-provider-keys
POST — admin/owner only. `requireRole(user, 'admin')`.
- If `plan_tier = 'fully_subscribed'` → HTTP 403 `{error: 'api_key_management_disabled_on_fully_subscribed_plan'}`
- Accepts `{provider_key: string, api_key: string, key_label?: string}`
- Validate `provider_key` exists in `model_providers` with `is_active = true` → HTTP 400 if not
- AES-256-GCM encrypt `api_key` using `ENCRYPTION_KEY` env var
- UPSERT into `org_provider_api_keys` (INSERT ... ON CONFLICT (org_id, provider_key) DO UPDATE)
- Returns `{saved: true, provider_key}` — raw key NEVER in response

### delete-provider-key
DELETE — admin/owner only. `requireRole(user, 'admin')`.
- Accepts `{provider_key: string}`
- DELETE from `org_provider_api_keys WHERE org_id = $org_id AND provider_key = $provider_key` using SERVICE role client
- Returns `{deleted: true, provider_key}`

### get-usage-stats
GET — admin/owner only. `requireRole(user, 'admin')`.
- Query param: `period = 'day' | 'week' | 'month' | 'all'` (default: 'month')
- Period to date range:
  ```typescript
  const since = period === 'day' ? 'now() - INTERVAL \'1 day\'' :
                period === 'week' ? 'now() - INTERVAL \'7 days\'' :
                period === 'month' ? 'now() - INTERVAL \'30 days\'' : '\'1970-01-01\''
  ```
- Query `llm_usage_events WHERE org_id = $org_id AND called_at >= {since}`:
  ```sql
  SELECT provider_key, model_id, step_key, key_source_used,
    COUNT(*) as total_calls,
    SUM(prompt_tokens) as prompt_tokens,
    SUM(completion_tokens) as completion_tokens,
    SUM(estimated_cost_usd) as estimated_cost_usd
  GROUP BY provider_key, model_id, step_key, key_source_used
  ORDER BY estimated_cost_usd DESC NULLS LAST
  ```
- Returns:
  ```typescript
  {
    period,
    by_model: [{provider_key, model_id, step_key, total_calls, prompt_tokens, completion_tokens, estimated_cost_usd, key_source_used}],
    totals: {total_calls, total_tokens, estimated_cost_usd},
    key_source_split: {platform: {calls, cost_usd}, user: {calls, cost_usd}}
  }
  ```

### dodopayments-webhook
POST — PUBLIC endpoint. NO JWT auth. NO requireRole.
- **Verify HMAC signature first** before any other processing:
  ```typescript
  const signature = req.headers.get('dodo-signature') ?? req.headers.get('x-signature')
  const body = await req.text()
  const secret = Deno.env.get('DODO_WEBHOOK_SECRET')!
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['verify'])
  const signatureBytes = Uint8Array.from(atob(signature!), c => c.charCodeAt(0))
  const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(body))
  if (!valid) return new Response('Invalid signature', {status: 400})
  ```
  Return HTTP 200 immediately after signature verification, then process async.
- Parse event from `JSON.parse(body)`
- Handle events (spec Section 13.2):
  - `subscription.created` / `subscription.updated`:
    - Map Dodo plan to tier: `{starter: {seat_limit: 2, image_quota: 50, video_quota: 5}, growth: {seat_limit: 5, image_quota: 300, video_quota: 30}, scale: {seat_limit: 20, image_quota: 999999, video_quota: 100}}`
    - UPDATE orgs SET plan_tier, seat_limit, image_quota, video_quota, dodo_subscription_id WHERE dodo_customer_id = $customer_id
  - `subscription.cancelled`: UPDATE orgs SET plan_tier='starter', seat_limit=2, image_quota=50, video_quota=5
  - `invoice.paid`: UPDATE orgs SET image_used=0, video_used=0, quota_reset_at=date_trunc('month', now()) + INTERVAL '1 month'

Deploy all 8 Edge Functions via `deploy_edge_function`. Verify all with `get_logs`.

---

## PART 2 — /settings/models Page

Create `apps/web/app/(dashboard)/settings/models/page.tsx` (spec Section 11.6). Full implementation:

### On page load:
- Call `get-available-models` Edge Function — show loading spinner
- On failure: show Retry button, render saved preferences (from TanStack Query cache)

### Recommendations carousel (DB-driven):
- Shows `is_recommended = true` models from response, ordered by `recommendation_order`
- Each card: model_label, provider badge, cost_tier badge, recommendation_text, release_date
- Horizontal scroll carousel using shadcn `<ScrollArea>` or Embla Carousel

### Provider key status badges (row at top):
- One badge per active provider: green = org key set, amber = platform key active (no org key), red = no key (user_required models locked)
- Each badge is clickable — scrolls to that provider's key card below

### 7 Step Cards (spec Section 11.6):
For each step:
1. **Image Generation**: model_type='image', compatible_step_keys includes 'image_generation', default: google/gemini-3.1-flash-image-preview (OpenRouter)
2. **Video Generation**: model_type='video', default: veo-3.1-generate-preview (Google AI Studio)
3. **Prompt Assembly**: model_type='text', default: gemini-3-flash-preview (Google AI Studio)
4. **Relevance Scoring**: model_type='text', default: gemini-3-flash-preview — show note: 'In v1, ingest-signals uses TF-IDF (zero AI cost). This card reserves configuration for future on-demand AI rescoring.'
5. **Outreach Copy**: model_type='text', default: gemini-3-flash-preview (Google AI Studio)
6. **Campaign Brief**: model_type='text', default: gemini-3-flash-preview (Google AI Studio)
7. **Brand Embedding**: model_type='embedding', default: perplexity/pplx-embed-v1-0.6b (OpenRouter)

Each card:
- Searchable dropdown of compatible models: show `model_label (provider)`, `cost_tier` badge, estimated_time_seconds, lock icon (🔒) if `has_org_key=false && platform_key_available=false`
- 'Default' badge on the system default
- 'Reset to default' link
- Inline 'Save' button for that step

'Save all changes' button at bottom — calls `save-model-preferences` with all changed steps.

### Provider API Keys section:
One card per active provider from `providers` array:
- Provider display_name + docs_url link
- Key status badge
- `<Input type="password" placeholder="Paste your API key" />` — masked
- 'Save' button → calls `save-provider-keys`
- 'Delete' button → confirmation dialog → calls `delete-provider-key`
- Below input (always visible): 'Your key is AES-256-GCM encrypted before storage and cannot be viewed after saving — only replaced or deleted.'
- ALL input fields disabled with lock icon + tooltip when `plan_tier = 'fully_subscribed'`

### Member role users:
- All inputs, Save, Delete buttons are disabled
- Show tooltip: 'Contact your admin to change this setting.'

---

## PART 3 — /settings/usage Page

Create `apps/web/app/(dashboard)/settings/usage/page.tsx` (spec Section 11.7).

- Date range tabs: Today | Last 7 days | Last 30 days | All time. Default: Last 30 days.
- On tab change: call `get-usage-stats?period={day|week|month|all}` with TanStack Query, `queryKey: ['usage-stats', period]`
- Two stat cards at top:
  - 'Platform calls' — `key_source_split.platform.calls` calls, `$key_source_split.platform.cost_usd` est. cost
  - 'Your API key calls' — `key_source_split.user.calls` calls, `$key_source_split.user.cost_usd` est. cost (billed to your accounts)
- Usage table (shadcn DataTable):
  - Columns: Provider | Model | Step | Calls | Input Tokens | Output Tokens | Est. Cost (USD) | Key Source
  - 'Key Source' column: 'Platform' badge (green) or 'Your key' badge (blue)
  - Total row at bottom
- Disclaimer note below table (spec Section 11.7 exact text)
- Empty state: 'No AI usage recorded yet. Generate a trend image or run an outreach copy step to see usage here.'
- Accessible to admin and owner only — redirect Member to /dashboard with toast 'Upgrade required'

---

## PART 4 — /settings/billing Page

Create `apps/web/app/(dashboard)/settings/billing/page.tsx`.

- Fetch current org data: `plan_tier`, `image_used`, `image_quota`, `video_used`, `video_quota`, `quota_reset_at`, `seat_limit`
- Current plan card:
  - Plan name badge (Starter / Growth / Scale)
  - Usage meters: Images used / quota, Videos used / quota (progress bars)
  - Seat usage: active members / seat_limit
  - Next reset date: `quota_reset_at`
- Plan upgrade cards (only shown to Owner role):
  ```
  Starter: $49/mo — 2 seats, 50 images, 5 videos  [Current plan badge if on starter]
  Growth:  $149/mo — 5 seats, 300 images, 30 videos  [Upgrade button]
  Scale:   $399/mo — 20 seats, Unlimited images, 100 videos  [Upgrade button]
  ```
  'Upgrade' button → calls Dodo Payments checkout link (use Dodo SDK to create checkout session)
- Payment method section (Owner only): Dodo Payments customer portal link
- For Admin and Member roles: hide Upgrade and payment method sections. Show: 'Contact your org owner to change billing.'

### Quota enforcement — upgrade modal:
When `check-quota` returns `quota_exceeded`: show a shadcn `<Dialog>` overlay (NOT an alert):
- Title: 'Generation limit reached'
- Body: 'You've used all {quota} images this month. Your quota resets on {quota_reset_at}.'
- CTA button: 'Upgrade plan' → links to /settings/billing
- Secondary: 'Wait for reset'

---

## PART 5 — /settings/team Page

Create `apps/web/app/(dashboard)/settings/team/page.tsx`.

- Fetch `org_members JOIN auth.users WHERE org_id = $org_id` — via Supabase client
  - NOTE: cannot directly join auth.users via RLS. Instead: fetch org_members, then for each member call a server component to get the email, OR use `supabase.auth.admin.listUsers()` in a server component (uses service role).
  - Alternative: add `email text` column to org_members populated on invite — simpler for v1.
- Members table:
  - Columns: Email, Role badge (Owner/Admin/Member), Status badge (Active/Pending), Joined date, Actions
  - Actions column: 'Remove' button (admin/owner only) + 'Change role' dropdown (owner only)
  - 'Remove' → confirmation dialog → calls `remove-member` Edge Function
  - 'Change role' → calls `remove-member` with `action='change_role'`
  - Current user's row: no action buttons (cannot self-remove)
  - Owner row: no action buttons for admins (cannot remove owner)
- Invite form (admin/owner only):
  - Email input + Role dropdown (Admin | Member)
  - 'Invite' button → calls `invite-user` Edge Function
  - On success: toast 'Invite sent to {email}'
  - On seat_limit_reached: 'Seat limit reached. Upgrade your plan to invite more members.'
- Seat counter: 'X of Y seats used' above the table

---

## PART 6 — Observability (complete implementation)

### Complete _shared/observability.ts
```typescript
import Langfuse from 'npm:langfuse'

interface UsageEvent {
  org_id: string; org_slug: string; provider_key: string; model_id: string
  step_key: string | null; job_id: string | null; key_source_used: string
  prompt_tokens: number | null; completion_tokens: number | null; total_tokens: number | null
  estimated_cost_usd: number | null; latency_ms: number; success: boolean; error_code: string | null
  input?: string | null; output?: string | null; start_time?: Date; end_time?: Date
}

export async function recordUsage(supabase: any, event: UsageEvent): Promise<void> {
  // Track 1: DB insert (powers /settings/usage)
  try {
    await supabase.from('llm_usage_events').insert({
      org_id: event.org_id, provider_key: event.provider_key, model_id: event.model_id,
      step_key: event.step_key, job_id: event.job_id, key_source_used: event.key_source_used,
      prompt_tokens: event.prompt_tokens, completion_tokens: event.completion_tokens,
      total_tokens: event.total_tokens, estimated_cost_usd: event.estimated_cost_usd,
      latency_ms: event.latency_ms, success: event.success, error_code: event.error_code,
    })
  } catch (err) {
    console.error('[observability] DB insert failed:', err)
    // Sentry capture here if SENTRY_DSN set
  }

  // Track 2: Langfuse SDK trace (operator cost visibility across all providers)
  const langfuseKey = Deno.env.get('LANGFUSE_PUBLIC_KEY')
  if (!langfuseKey) return  // silently skip if not configured
  
  let langfuse: any
  try {
    langfuse = new Langfuse({
      publicKey: langfuseKey,
      secretKey: Deno.env.get('LANGFUSE_SECRET_KEY')!,
      baseUrl: Deno.env.get('LANGFUSE_HOST') ?? 'https://cloud.langfuse.com',
    })
    const trace = langfuse.trace({
      userId: event.org_id,
      sessionId: event.job_id ?? event.step_key ?? 'no-session',
      metadata: {org_id: event.org_id, org_slug: event.org_slug, step_key: event.step_key, provider_key: event.provider_key, key_source_used: event.key_source_used}
    })
    trace.generation({
      model: event.model_id,
      modelParameters: {provider: event.provider_key},
      usage: {promptTokens: event.prompt_tokens ?? 0, completionTokens: event.completion_tokens ?? 0, totalTokens: event.total_tokens ?? 0},
      input: event.input ?? null,
      output: event.output ?? null,
      startTime: event.start_time,
      endTime: event.end_time,
      ...(event.success ? {} : {level: 'ERROR', statusMessage: event.error_code ?? 'unknown'})
    })
  } catch (err) {
    console.error('[observability] Langfuse trace failed:', err)
  } finally {
    // CRITICAL: must call shutdownAsync() in Deno — no persistent event loop to flush queue
    if (langfuse) {
      try { await langfuse.shutdownAsync() } catch { /* ignore */ }
    }
  }
}
```

Verify that ALL non-OpenRouter provider adapters call `recordUsage`:
- `providers/fal.ts`: call after `pollFalVideoJob` result
- `providers/google_ai_studio.ts`: call after `callGoogleAIStudio[Video|Text|Image]` result
- `providers/anthropic.ts`: call after `callAnthropic` result
- `providers/openai.ts`: call after `callOpenAI` and `embedText`
- `providers/openrouter.ts`: does NOT call recordUsage — OpenRouter Broadcast handles this

---

## PART 7 — Sentry Integration

### Frontend (Next.js):
```bash
cd apps/web
npx @sentry/wizard@latest -i nextjs
```
The wizard creates `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`. Configure with `NEXT_PUBLIC_SENTRY_DSN`.

Add error boundary to `apps/web/app/(dashboard)/layout.tsx`:
```tsx
import * as Sentry from '@sentry/nextjs'
// Wrap layout children in ErrorBoundary
```

### Edge Functions:
Add to all Edge Functions that call `recordUsage` — already handled inside observability.ts. For direct Edge Function errors, add:
```typescript
import * as Sentry from 'npm:@sentry/deno'  // or use fetch to Sentry API directly
// In catch blocks: Sentry.captureException(err) — only if SENTRY_DSN is set
```
Simple alternative without SDK — POST to Sentry API:
```typescript
async function captureError(err: Error, context: Record<string, any>) {
  const dsn = Deno.env.get('SENTRY_DSN')
  if (!dsn) return
  // parse DSN and POST to Sentry store endpoint
  // ... or just console.error which Supabase captures in Edge Function logs
}
```

---

## PART 8 — Quota enforcement in generate-asset

Edit `supabase/functions/generate-asset/index.ts` — ensure HTTP 402 is properly surfaced to the frontend:
```typescript
if (imageUsed >= imageQuota) {
  return new Response(JSON.stringify({
    error: 'quota_exceeded',
    quota_type: 'image',
    quota: imageQuota,
    used: imageUsed,
    resets_at: org.quota_reset_at
  }), {status: 402})
}
```

Edit `apps/web/app/(dashboard)/create/page.tsx` — handle 402 response:
```typescript
if (response.status === 402) {
  const body = await response.json()
  setShowUpgradeModal(true)
  setQuotaError(body)
  return
}
```

---

## PART 9 — Loading, Error, and Empty States

Add to ALL pages that were missing them (final polish pass):

For every page:
- `loading.tsx` — shadcn `<Skeleton>` matching the page layout
- `error.tsx` — user-friendly message + 'Try again' button (calls `router.refresh()`)
- Empty state within page components — meaningful message + action CTA

Use shadcn: `npx shadcn@latest add alert alert-dialog`
For toasts use Sonner (NOT shadcn toast): `npm install sonner` then add `<Toaster position="bottom-right" theme="dark" richColors />` in `app/layout.tsx` and `import { toast } from "sonner"` everywhere. See ui-design.instructions.md §8.

---

## PART 10 — README.md

Create `README.md` at monorepo root. Include:

```markdown
# GTM Engine

B2B SaaS GTM Intelligence Engine — trend discovery, AI content creation, ICP discovery, outreach personalisation.

## Stack
- Frontend: Next.js 14, Tailwind CSS, shadcn/ui, hosted on Cloudflare Pages
- Backend: Supabase Edge Functions (Deno/TypeScript)
- Database: Supabase Postgres + pgvector + pg_cron
- Payments: Dodo Payments

## Local Development

### Prerequisites
- Node.js 20+
- Supabase CLI: `npm install -g supabase`
- Deno 1.40+ (for Edge Functions)

### Setup
1. Clone the repo
2. Copy `.env.local.example` to `apps/web/.env.local` and fill all values
3. Start Supabase locally: `supabase start`
4. Run migrations: `supabase db push`
5. Deploy Edge Functions locally: `supabase functions serve`
6. Start frontend: `cd apps/web && npm install && npm run dev`

### Environment Variables

**Frontend (apps/web/.env.local):**
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_DODO_PUBLISHABLE_KEY
- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_SENTRY_DSN

**Supabase Edge Functions (set via `supabase secrets set`):**
- SUPABASE_SERVICE_ROLE_KEY
- ENCRYPTION_KEY — 32-byte random string (use: `openssl rand -base64 32`)
- OPENROUTER_DEFAULT_API_KEY
- GOOGLE_AI_STUDIO_API_KEY
- RESEND_API_KEY
- DODO_WEBHOOK_SECRET
- LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST
- PDL_API_KEY, APOLLO_API_KEY, HUNTER_API_KEY, CLEARBIT_API_KEY
- (Optional) FAL_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY
- APP_URL

### Migration Order
Run in order: 0001 → 0002 → 0003 → 0004 → 0005 → 0006

### Build Order
Weeks 1–6 (see .github/prompts/week1.prompt.md through week6.prompt.md)

## Deployment
- Frontend: auto-deployed to Cloudflare Pages on push to `main`
- Edge Functions: `supabase functions deploy <name>`
- Database: `supabase db push` (runs pending migrations)
```

Also create `apps/web/.env.local.example` with all variables listed above (empty values).

---

## PART 11 — Verification

**End-of-week test (spec Section 17 Week 6):**
1. Complete billing flow: sign up, upgrade from Starter to Growth via Dodo Payments checkout
2. Verify webhook fires: `dodopayments-webhook` receives event, org plan_tier updates to 'growth', seat_limit updates to 5
3. Generate 51 images on a Starter-tier org (or set image_used = image_quota in DB): verify upgrade modal appears on the 51st attempt
4. Invite a second user (as owner): verify seat count increases, invite email received
5. Second user accepts invite via email link, lands on /onboarding
6. Navigate to /settings/team: both users visible, correct roles and status badges
7. Navigate to /settings/models: recommendations carousel loads, all 7 step cards show correct defaults, save a model preference, verify it persists on page reload
8. Navigate to /settings/usage: usage table shows entries from Weeks 3–5 testing, cost estimates appear
9. Check Sentry dashboard: no unhandled errors from the full flow
10. All pages have loading skeletons (check by throttling network to 'Slow 3G' in DevTools)
11. Get 3 paying users before building anything else (spec Section 17 Week 6 final note)
