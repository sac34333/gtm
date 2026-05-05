# GTM Engine — Pre-Demo & Pre-Handoff Test Plan

**Version:** 1.0  
**Date:** 5 May 2026  
**Environment under test:** Production — `https://gtmengine.qubitlyventures.com`  
**Supabase project:** `ycsfossrrntwhegmyrze`  
**Scope:** Full system test — 200+ cases across UI, Edge Functions, DB, security, billing, mobile, cron, observability.

---

## 0. Executive Summary — Auto-Verified Live State

Captured live from production via Supabase MCP on 5 May 2026.

### Database
| Check | Status | Detail |
|---|---|---|
| Tables in `public` | ✅ 20 | All have `rls_enabled = true` |
| Migrations applied | ✅ 35 | `0001` → `0026_campaign_duration_days` |
| Storage buckets | ✅ 3 | `assets`, `brands`, `briefs` — **all `public = false`** |
| pg_cron jobs | ✅ 5 active | See cron section below |
| RLS policies | ✅ 67 | 4-policy CRUD set on every org-scoped table |

### Cron jobs
| Job | Schedule | Active |
|---|---|---|
| `archive-old-signals` | `0 2 * * *` (daily 02:00 UTC) | ✅ |
| `cleanup-apify-signals` | `0 * * * *` (hourly) | ✅ |
| `ingest-all-signals` | `*/15 * * * *` (every 15 min) | ✅ |
| `poll-generation-jobs` | `* * * * *` (every minute) | ✅ |
| `reset-monthly-quotas` | `0 0 1 * *` (1st of month 00:00 UTC) | ✅ |

### Edge Functions deployed (31)
**JWT-protected (20):** `create-org`, `accept-invite`, `get-upload-url`, `save-onboarding`, `archive-old-signals`, `cleanup-apify-signals`, `reset-monthly-quotas`, `update-org-settings`, `save-data-source-key`, `delete-data-source-key`, `check-quota`, `submit-feedback`, `get-available-models`, `add-campaign-prospects`, `invite-user`, `remove-member`, `save-model-preferences`, `save-provider-keys`, `delete-provider-key`, `get-usage-stats`

**`verify_jwt = false` (11) — must self-verify or be public:**
- ✅ Cron (use `X-Cron-Secret`): `ingest-signals`, `poll-job-status`
- ✅ Public webhook (HMAC): `dodopayments-webhook`
- ⚠️ User-callable but `verify_jwt=false` — **MUST manually validate JWT in code**: `build-prompt`, `generate-asset`, `icp-enrich`, `personalise`, `generate-campaign-brief`, `create-campaign`, `update-campaign`, `generate-captions`
  → **TC-SEC-014** below verifies each rejects un-authenticated requests with 401.

### Security Advisors (live lints)
| Severity | Issue | Action |
|---|---|---|
| ⚠️ WARN | `public.current_org_id` function has mutable `search_path` | Add `SET search_path = public, pg_catalog` to definition (post-demo) |
| ⚠️ WARN | `pg_net` extension installed in `public` schema | Move to `extensions` schema (post-demo, requires app-side reference update) |
| ⚠️ WARN | Auth leaked-password protection disabled | Enable in Supabase Dashboard → Auth → Password security (5 min, do before handoff) |

### Performance Advisors (informational)
| Issue | Tables | Impact |
|---|---|---|
| Unindexed FK | `icp_enrichment_runs.user_id`, `outreach_copies.prospect_id`, `prospects.last_campaign_id`, `signals.feed_config_id` | Low at current scale; add indexes in next migration |
| `auth_rls_initplan` | `campaign_prospects` (and others) | Per-row re-evaluation of `auth.*()` — perf only, not security; rewrite as `(select auth.…())` post-demo |

### Bottom-line readiness
- ✅ **Demo-ready** — all 31 Edge Functions ACTIVE, all RLS enabled, all cron live, no security `ERROR`-level lints.
- ⚠️ **3 pre-handoff actions** before client takeover: enable HIBP, fix `current_org_id` search_path, add 4 missing indexes.

---

## 1. How to use this document

Each test case has:
- **ID** — `TC-<area>-<n>`
- **Priority** — `P0` (blocks demo) · `P1` (must work for handoff) · `P2` (nice-to-have)
- **Severity if it fails** — `Blocker` · `Major` · `Minor`
- **Status** — `[ ]` not run · `[P]` pass · `[F]` fail · `[B]` blocked · `[N/A]`

### Demo-critical subset
Search for the tag **`@demo`** to see only the 47 cases that MUST pass before the demo. They are also collected in §15.

---

## 2. Pre-flight checklist (run once)

| # | Check | Expected | Status |
|---|---|---|---|
| PRE-01 | `git log -1 --oneline` shows latest deploy | `31a695b` mobile fixes or newer | `[ ]` |
| PRE-02 | Cloudflare Pages deployment is `Production` (not preview) | Latest commit live on `gtmengine.qubitlyventures.com` | `[ ]` |
| PRE-03 | `.env.local` (local) and Supabase secrets (prod) all set | No `undefined` envs in Sentry | `[ ]` |
| PRE-04 | Supabase project status | Healthy (no paused warnings) | `[ ]` |
| PRE-05 | Sentry projects receiving events | Last event < 24h | `[ ]` |
| PRE-06 | Langfuse project receiving traces | Last trace < 1h | `[ ]` |
| PRE-07 | Test accounts ready | 2 separate orgs (Org A, Org B) for cross-tenant tests | `[ ]` |

---

## 3. Authentication & Authorisation

### 3.1 Sign-up / sign-in
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-AUTH-001 | New user sign-up | Visit `/signup` → email + pwd → submit | Email confirmation sent; redirected to `/login` with success toast | P0 | Blocker | ✅ | `[ ]` |
| TC-AUTH-002 | Sign-in success | `/login` with verified credentials | Redirect to `/dashboard` (or `/onboarding` if incomplete) | P0 | Blocker | ✅ | `[ ]` |
| TC-AUTH-003 | Sign-in wrong password | `/login` with bad password | Inline error, no redirect, no JWT issued | P0 | Major | ✅ | `[ ]` |
| TC-AUTH-004 | Sign-in unverified email | Sign in before clicking confirmation link | Error message asking to verify | P1 | Major | – | `[ ]` |
| TC-AUTH-005 | Forgot password flow | `/forgot-password` → enter email → check inbox → reset | New password works on `/login` | P1 | Major | – | `[ ]` |
| TC-AUTH-006 | Sign-out | Click "Sign out" in sidebar | Session cleared, redirect to `/login`, browser back returns to login (no PII leak) | P0 | Major | ✅ | `[ ]` |
| TC-AUTH-007 | OAuth callback handler | Visit `/auth/callback?code=…` directly with no code | Graceful error, no crash | P2 | Minor | – | `[ ]` |
| TC-AUTH-008 | Password reset token expiry | Use a >24h-old reset link | Token-expired error | P2 | Minor | – | `[ ]` |
| TC-AUTH-009 | Concurrent sessions | Sign in same user in 2 browsers | Both work; sign-out in one does not kill the other | P2 | Minor | – | `[ ]` |

### 3.2 Org isolation (RLS) — see also `testing/security-verification.sql`
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-AUTH-010 | Cross-org signal read blocked | As Org A user, query `signals` where `org_id = OrgB.id` via supabase-js | Returns empty array (RLS filter), no 401 | P0 | Blocker | ✅ | `[ ]` |
| TC-AUTH-011 | Cross-org prospect insert blocked | Try to INSERT prospect with `org_id = OrgB.id` | RLS denies insert | P0 | Blocker | ✅ | `[ ]` |
| TC-AUTH-012 | Cross-org generation_jobs update blocked | Try to UPDATE Org B's job | 0 rows affected | P0 | Blocker | – | `[ ]` |
| TC-AUTH-013 | Cross-org org_api_keys read blocked | SELECT from `org_api_keys` where org ≠ mine | Empty result | P0 | Blocker | – | `[ ]` |
| TC-AUTH-014 | `available_models` is public read | SELECT from `available_models` as anon (or any user) | Returns 33 rows | P1 | Minor | – | `[ ]` |
| TC-AUTH-015 | `prompt_templates` follows its own policy | SELECT as user not in templates' org | RLS rules apply correctly | P1 | Major | – | `[ ]` |

### 3.3 JWT-claim-based org_id
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-AUTH-016 | org_id read from JWT only | curl any user-facing function with body `{"org_id": "OrgB.id"}` and Org A JWT | Function ignores body org_id, uses JWT claim → operates on Org A | P0 | Blocker | ✅ | `[ ]` |
| TC-AUTH-017 | Tampered JWT rejected | Modify JWT signature char | 401 Invalid token | P0 | Blocker | – | `[ ]` |
| TC-AUTH-018 | Expired JWT rejected | Use >1h-old session token | 401, frontend redirects to `/login` | P1 | Major | – | `[ ]` |
| TC-AUTH-019 | Anon JWT rejected on protected fn | Call `/functions/v1/check-quota` with anon key only | 401 | P0 | Blocker | – | `[ ]` |

### 3.4 Role enforcement (admin vs member)
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-AUTH-020 | Member cannot invite | `invite-user` as `member` role | 403 Forbidden | P1 | Major | – | `[ ]` |
| TC-AUTH-021 | Member cannot remove member | `remove-member` as member | 403 | P1 | Major | – | `[ ]` |
| TC-AUTH-022 | Member cannot save provider keys | `save-provider-keys` as member | 403 | P1 | Major | – | `[ ]` |
| TC-AUTH-023 | Admin can do all of the above | Same as 020-022 with admin role | 200 | P0 | Blocker | ✅ | `[ ]` |

---

## 4. Onboarding

| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-ONB-001 | First-time user → /onboarding | Sign up → confirm email → sign in | Auto-redirect to `/onboarding` (not `/dashboard`) | P0 | Blocker | ✅ | `[ ]` |
| TC-ONB-002 | Org name + slug step | Type org name, slug auto-generates | Slug is URL-safe, lowercase, no spaces | P0 | Blocker | ✅ | `[ ]` |
| TC-ONB-003 | Slug uniqueness | Try existing slug | Inline error before submit | P1 | Major | – | `[ ]` |
| TC-ONB-004 | Brand context upload (PDF) | Upload a 2 MB PDF | Parses, summary appears, saved to `brand_contexts` | P1 | Major | – | `[ ]` |
| TC-ONB-005 | Brand context upload (image) | Upload a 1 MB PNG logo | Saved to `brands` Storage bucket via signed URL | P1 | Minor | – | `[ ]` |
| TC-ONB-006 | Brand context upload >1 MB body | Upload 10 MB PDF | Either uploads via signed URL OR returns 413 (per spec rule 13) | P1 | Major | – | `[ ]` |
| TC-ONB-007 | Country / region selection | Pick India | `orgs.country_code = 'IN'` | P1 | Minor | – | `[ ]` |
| TC-ONB-008 | Default ICP fields | Fill industry / company size / persona | Saved to org metadata | P0 | Blocker | ✅ | `[ ]` |
| TC-ONB-009 | Skip optional steps | Skip brand upload | Onboarding still completes | P1 | Minor | – | `[ ]` |
| TC-ONB-010 | Complete onboarding | Submit final step | `orgs.onboarding_complete = true`, redirect to `/dashboard` | P0 | Blocker | ✅ | `[ ]` |
| TC-ONB-011 | Re-visit /onboarding after complete | Visit `/onboarding` directly | Redirect to `/dashboard` | P1 | Minor | – | `[ ]` |
| TC-ONB-012 | Onboarding resume | Close mid-way → reopen | Lands on last completed step | P2 | Minor | – | `[ ]` |

---

## 5. Signals — Ingestion & Dashboard

### 5.1 Source adapters (12 sources)
For each source: `RSS`, `HackerNews`, `ProductHunt`, `GitHub`, `YouTube`, `Reddit`, `NewsAPI`, `Twitter`, `GDELT`, `Apify LinkedIn`, `Tavily`, `Brave Search` (+ regional variants).

| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-SIG-001 | RSS feed ingestion | Add a working RSS URL in `/settings` → wait for next cron tick | New `signals` rows with `source='rss'` | P0 | Blocker | ✅ | `[ ]` |
| TC-SIG-002 | HackerNews adapter | Default config | Items appear, `score` populated | P1 | Major | – | `[ ]` |
| TC-SIG-003 | Reddit adapter | Save Reddit API key, configure subreddit | Items appear with `source='reddit'` | P1 | Major | – | `[ ]` |
| TC-SIG-004 | NewsAPI adapter | Save NewsAPI key | Items with `source='newsapi'` | P1 | Major | – | `[ ]` |
| TC-SIG-005 | Apify LinkedIn adapter | Save Apify token | Async job created; signals appear after run | P1 | Major | – | `[ ]` |
| TC-SIG-006 | Invalid API key | Save bogus NewsAPI key | Saved encrypted; ingest run logs error, no crash | P0 | Major | – | `[ ]` |
| TC-SIG-007 | Source returns 0 items | Empty RSS feed | Run completes successfully, no error toast | P1 | Minor | – | `[ ]` |
| TC-SIG-008 | Source returns malformed data | RSS with broken XML | Adapter catches, logs to Sentry, run continues | P1 | Minor | – | `[ ]` |
| TC-SIG-009 | Deduplication | Same URL ingested twice | Single row in `signals` (unique URL+org constraint) | P0 | Major | ✅ | `[ ]` |
| TC-SIG-010 | TF-IDF scoring | Ingest 50 signals from 3 sources | `score` column populated, sorts sensibly | P1 | Major | – | `[ ]` |
| TC-SIG-011 | Cron tick on schedule | Wait 15 min; check `cron.job_run_details` | New row, status `succeeded` | P0 | Blocker | ✅ | `[ ]` |
| TC-SIG-012 | `archive-old-signals` job | Insert a signal with `created_at = now() - 90 days` → wait for 02:00 UTC | Signal moved/marked archived | P1 | Minor | – | `[ ]` |
| TC-SIG-013 | `cleanup-apify-signals` | Insert stale Apify run | Cleaned up next hour | P2 | Minor | – | `[ ]` |
| TC-SIG-014 | Concurrent ingest runs | Manually trigger while cron runs | No duplicate rows; lock or idempotency works | P1 | Major | – | `[ ]` |
| TC-SIG-015 | Disable ingestion toggle | Toggle `signal_ingestion_enabled=false` | Next cron run skips this org | P0 | Major | ✅ | `[ ]` |
| TC-SIG-016 | Frequency setting | Set to "every 2 days" | Org skipped on intermediate ticks | P1 | Major | – | `[ ]` |

### 5.2 Dashboard UI
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-SIG-020 | `/dashboard` loads | After onboarding | Trend dashboard renders, no console errors | P0 | Blocker | ✅ | `[ ]` |
| TC-SIG-021 | Empty state | New org with 0 signals | Helpful empty CTA, not blank screen | P0 | Major | ✅ | `[ ]` |
| TC-SIG-022 | Signal card → detail | Click a signal | `/dashboard/signal/[id]` renders | P0 | Blocker | ✅ | `[ ]` |
| TC-SIG-023 | Signal → Create asset CTA | "Create asset" button on signal | Pre-fills `/create?signalId=…` | P0 | Blocker | ✅ | `[ ]` |
| TC-SIG-024 | Filter by source | Pick "Reddit" only | Only Reddit signals show | P1 | Minor | – | `[ ]` |
| TC-SIG-025 | Filter by date range | Last 7 days | Older signals hidden | P1 | Minor | – | `[ ]` |
| TC-SIG-026 | Search box | Search keyword | Matches title + summary | P1 | Minor | – | `[ ]` |
| TC-SIG-027 | Pagination | Scroll past 50 signals | Loads more / pagination works | P1 | Minor | – | `[ ]` |

---

## 6. Create — Asset generation (image + video)

### 6.1 Image generation (synchronous flow)
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-CRE-001 | Open `/create` from sidebar | Click Create | Form renders, quota counters visible | P0 | Blocker | ✅ | `[ ]` |
| TC-CRE-002 | Open `/create?signalId=…` | From signal page | Signal context banner appears | P0 | Blocker | ✅ | `[ ]` |
| TC-CRE-003 | Generate image — happy path | Fill subject + tags → Generate | Job created; image appears within 30s | P0 | Blocker | ✅ | `[ ]` |
| TC-CRE-004 | Image stored in private bucket | Inspect signed URL | URL has `?token=…&expires=…`, expires in 1h | P0 | Major | ✅ | `[ ]` |
| TC-CRE-005 | Captions auto-generated | After image succeeds | `outreach_copies` populated for LinkedIn/Twitter/etc within 10s | P0 | Blocker | ✅ | `[ ]` |
| TC-CRE-006 | Caption "Regenerate all" works | Click | New captions overwrite, no duplicate rows | P1 | Major | – | `[ ]` |
| TC-CRE-007 | Per-platform regen | Click LinkedIn ✨ | Only LinkedIn caption updates | P1 | Minor | – | `[ ]` |
| TC-CRE-008 | Refinement options | Click "Make it more energetic" | New variant, original kept in history | P1 | Minor | – | `[ ]` |
| TC-CRE-009 | Quota enforcement | Generate while at quota | 402/429 with helpful error, no charge | P0 | Blocker | ✅ | `[ ]` |
| TC-CRE-010 | Quota refund on failure | Provider returns 500 mid-generation | `quota_refunded_flag` set, `image_used` decremented | P1 | Major | – | `[ ]` |
| TC-CRE-011 | Use brand context | Brand uploaded → generate | Image follows brand colours/style | P1 | Major | – | `[ ]` |
| TC-CRE-012 | Download image | Click Download | File saves with sensible name | P0 | Major | ✅ | `[ ]` |
| TC-CRE-013 | Use for campaign | Click "Use for campaign" | Pre-fills campaign new with this asset | P1 | Major | – | `[ ]` |
| TC-CRE-014 | Empty subject rejected | Submit blank subject | Inline validation error, no API call | P1 | Major | – | `[ ]` |
| TC-CRE-015 | Subject >200 chars rejected | Paste 500 chars | Truncated to 200 or rejected | P1 | Minor | – | `[ ]` |
| TC-CRE-016 | Invalid model selection | Pick deprecated model | Falls back to default chain | P1 | Major | – | `[ ]` |
| TC-CRE-017 | Concurrent generations | Trigger 3 in 2s | All three queued/processed, none lost | P1 | Major | – | `[ ]` |

### 6.2 Video generation (async flow)
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-CRE-020 | Generate video happy path | Switch to Video tab → submit | Job created `status=processing`; UI shows "Processing…" | P0 | Blocker | ✅ | `[ ]` |
| TC-CRE-021 | poll-job-status updates | Wait 1-3 min | Status flips to `succeeded`; preview appears | P0 | Blocker | ✅ | `[ ]` |
| TC-CRE-022 | Email notification on completion | Wait for job | Email arrives with link to `/create/[job_id]` | P1 | Major | – | `[ ]` |
| TC-CRE-023 | Video player works | Open completed job | Plays inline; no CORS errors | P0 | Blocker | ✅ | `[ ]` |
| TC-CRE-024 | Video quota enforced | Generate at quota | 402, no charge | P0 | Major | ✅ | `[ ]` |
| TC-CRE-025 | Failed video job | Provider error | `status=failed`, error visible to user, quota refunded | P1 | Major | – | `[ ]` |
| TC-CRE-026 | Long-running poll | 10+ min job | poll-job-status keeps checking, doesn't time out | P1 | Major | – | `[ ]` |

---

## 7. Library

| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-LIB-001 | `/library` loads | Click Library | All assets render in grid | P0 | Blocker | ✅ | `[ ]` |
| TC-LIB-002 | Empty state | New org | Helpful empty card | P1 | Minor | – | `[ ]` |
| TC-LIB-003 | Image preview | Click image | Modal/lightbox opens | P0 | Major | ✅ | `[ ]` |
| TC-LIB-004 | Video preview | Click video | Plays | P1 | Major | – | `[ ]` |
| TC-LIB-005 | Filter by type | Image only | Videos hidden | P1 | Minor | – | `[ ]` |
| TC-LIB-006 | Sort by date / quality | Toggle | Order updates | P2 | Minor | – | `[ ]` |
| TC-LIB-007 | Cross-org isolation | As Org B, library should not show Org A assets | RLS enforced | P0 | Blocker | – | `[ ]` |
| TC-LIB-008 | Signed URL expiry | Wait 1h after page load | URL expires; reload re-signs | P1 | Major | – | `[ ]` |

---

## 8. ICP — Enrichment & Personalisation

### 8.1 Prospect ingestion
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-ICP-001 | `/icp` loads | Click ICP | Prospects table renders | P0 | Blocker | ✅ | `[ ]` |
| TC-ICP-002 | Add prospect by LinkedIn URL | Paste URL → Add | Row inserted, enrichment kicked off | P0 | Blocker | ✅ | `[ ]` |
| TC-ICP-003 | Bulk CSV upload | Upload 10-row CSV | All rows enqueued | P1 | Major | – | `[ ]` |
| TC-ICP-004 | Duplicate LinkedIn URL | Add same URL twice | Single row (unique constraint `0025_prospects_unique_linkedin`) | P0 | Major | ✅ | `[ ]` |
| TC-ICP-005 | Invalid URL | Add `not-a-url` | Inline validation error | P1 | Minor | – | `[ ]` |
| TC-ICP-006 | Empty body | Submit empty | Validation error | P1 | Minor | – | `[ ]` |

### 8.2 Enrichment waterfall (PDL → Apollo → Hunter → Clearbit → web_scrape)
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-ICP-010 | Enrichment happy path | Add prospect with valid LinkedIn | `icp_enrichment_runs` row created; prospect enriched within 30s | P0 | Blocker | ✅ | `[ ]` |
| TC-ICP-011 | Falls through providers | Mock PDL 404 | Apollo tried next | P1 | Major | – | `[ ]` |
| TC-ICP-012 | All providers fail | Bogus URL | Status `failed`, helpful error | P1 | Major | – | `[ ]` |
| TC-ICP-013 | Partial save | PDL returns name only | Saved with what we have, score updated | P1 | Major | – | `[ ]` |
| TC-ICP-014 | `icp_score` calculation | Enrich a clear-fit prospect | Score 70-100 | P1 | Major | – | `[ ]` |
| TC-ICP-015 | `icp_score` low fit | Enrich misaligned prospect | Score 0-30, flagged | P1 | Major | – | `[ ]` |
| TC-ICP-016 | Sonar fallback | Provider keys missing | Falls back to Perplexity Sonar Pro | P1 | Major | – | `[ ]` |

### 8.3 Personalise email
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-ICP-020 | `/icp/[id]/personalise` loads | Click prospect → Personalise | Form renders with prospect context | P0 | Blocker | ✅ | `[ ]` |
| TC-ICP-021 | Generate email | Pick tone → Generate | Email body in `outreach_copies` | P0 | Blocker | ✅ | `[ ]` |
| TC-ICP-022 | Regenerate variant | Click regen | New variant, original retained | P1 | Major | – | `[ ]` |
| TC-ICP-023 | Copy to clipboard | Click copy | Toast confirms | P1 | Minor | – | `[ ]` |
| TC-ICP-024 | Empty enrichment | Personalise un-enriched prospect | Generic fallback or prompt to enrich first | P1 | Minor | – | `[ ]` |

---

## 9. Campaigns

| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-CMP-001 | `/campaigns` loads | Click Campaigns | List renders, filter chips work | P0 | Blocker | ✅ | `[ ]` |
| TC-CMP-002 | Filter by status | Pick "Draft" | Only drafts show | P1 | Minor | – | `[ ]` |
| TC-CMP-003 | Filter by type (mobile horizontal scroll) | On phone, swipe filter chips | Scrolls without overflow | P0 | Major | ✅ | `[ ]` |
| TC-CMP-004 | New campaign happy path | `/campaigns/new` → fill → save | Brief generated; redirect to `/campaigns/[id]` | P0 | Blocker | ✅ | `[ ]` |
| TC-CMP-005 | Generate campaign brief | Click "Generate brief" | Brief content populated; saved to `campaign_briefs` | P0 | Blocker | ✅ | `[ ]` |
| TC-CMP-006 | Add prospects to campaign | Click "Add prospects" → pick from ICP | Rows added to `campaign_prospects` | P0 | Blocker | ✅ | `[ ]` |
| TC-CMP-007 | Generate copies for prospects | Click "Generate copies" | Per-prospect copy created | P0 | Blocker | ✅ | `[ ]` |
| TC-CMP-008 | Regenerate copies | Click "Regenerate" | New variants overwrite | P1 | Major | – | `[ ]` |
| TC-CMP-009 | Update campaign metadata | Edit name → save | Persists | P1 | Minor | – | `[ ]` |
| TC-CMP-010 | Pause campaign | Toggle status to Paused | Updates, filters reflect | P1 | Minor | – | `[ ]` |
| TC-CMP-011 | Cross-org campaign access | Org B tries `/campaigns/<OrgA-id>` | 404 or RLS empty | P0 | Blocker | – | `[ ]` |
| TC-CMP-012 | Empty prospects list | Generate copies with 0 prospects | Helpful error, no crash | P1 | Major | – | `[ ]` |
| TC-CMP-013 | Campaign duration | Set 7-day campaign | `duration_days` saved | P1 | Minor | – | `[ ]` |

---

## 10. Settings

### 10.1 General
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-SET-001 | `/settings` loads | Click Settings | All sections visible | P0 | Major | ✅ | `[ ]` |
| TC-SET-002 | Update org name | Change → save | Persists in `orgs.name` | P1 | Minor | – | `[ ]` |
| TC-SET-003 | Toggle ingestion enabled | Toggle | `signal_ingestion_enabled` updated | P1 | Major | – | `[ ]` |
| TC-SET-004 | Country code update | Change | `country_code` updated | P2 | Minor | – | `[ ]` |

### 10.2 Models
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-SET-010 | `/settings/models` loads | Click Models | All 33 models listed | P1 | Major | – | `[ ]` |
| TC-SET-011 | Set default text model | Pick → save | `org_model_preferences` updated | P1 | Major | – | `[ ]` |
| TC-SET-012 | Set default image model | Pick → save | Updated | P1 | Major | – | `[ ]` |
| TC-SET-013 | Reset to default chain | Click reset | Org overrides cleared | P1 | Minor | – | `[ ]` |
| TC-SET-014 | Live model merge | New model added to `available_models` | Appears in UI without code change | P1 | Major | – | `[ ]` |

### 10.3 Provider keys (BYOK)
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-SET-020 | Save OpenRouter key | Paste → save | Stored encrypted in `org_provider_api_keys`; not visible in plain text | P0 | Blocker | ✅ | `[ ]` |
| TC-SET-021 | Save Fal.ai key | Paste → save | Encrypted | P1 | Major | – | `[ ]` |
| TC-SET-022 | Save Replicate key | Paste → save | Encrypted | P1 | Major | – | `[ ]` |
| TC-SET-023 | Toggle BYOK mode | Switch on | `orgs.byok_mode` updated, generation uses org keys | P1 | Major | – | `[ ]` |
| TC-SET-024 | Delete provider key | Click delete | Row removed | P1 | Major | – | `[ ]` |
| TC-SET-025 | Encrypted at rest | Inspect DB row directly | Value is base64 ciphertext, not plain | P0 | Blocker | ✅ | `[ ]` |
| TC-SET-026 | Encrypted in transit | Network tab on save | HTTPS only, no key in URL | P0 | Blocker | – | `[ ]` |

### 10.4 Data source keys
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-SET-030 | Save NewsAPI key | Save | Encrypted in `org_api_keys` | P1 | Major | – | `[ ]` |
| TC-SET-031 | Save Apify token | Save | Encrypted | P1 | Major | – | `[ ]` |
| TC-SET-032 | Delete data source key | Delete | Row removed; next ingest uses fallback | P1 | Major | – | `[ ]` |

### 10.5 Team
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-SET-040 | `/settings/team` loads | Click | Members listed | P0 | Major | ✅ | `[ ]` |
| TC-SET-041 | Invite by email | Enter email → invite | Invite row created; email sent | P0 | Blocker | ✅ | `[ ]` |
| TC-SET-042 | Accept invite | Open invite link | Joins org as member | P0 | Blocker | ✅ | `[ ]` |
| TC-SET-043 | Invite expired | Use 8-day-old invite | Expired error | P1 | Minor | – | `[ ]` |
| TC-SET-044 | Seat limit enforced | Invite past seat_limit | 402, upsell message | P1 | Major | – | `[ ]` |
| TC-SET-045 | Remove member | Click remove | Member kicked, can't access org | P1 | Major | – | `[ ]` |
| TC-SET-046 | Cannot remove self | Try | Disabled / 403 | P1 | Minor | – | `[ ]` |
| TC-SET-047 | Cannot remove last admin | Try | 403 | P1 | Major | – | `[ ]` |

### 10.6 Billing
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-SET-060 | `/settings/billing` loads | Click | Current plan + usage shown | P1 | Major | – | `[ ]` |
| TC-SET-061 | Upgrade plan | Click upgrade | Redirects to Dodo Payments checkout | P0 | Blocker | ✅ | `[ ]` |
| TC-SET-062 | Webhook updates plan | Complete checkout in test mode | Webhook fires; `orgs.plan_tier` updated | P0 | Blocker | ✅ | `[ ]` |
| TC-SET-063 | Cancel subscription | Click cancel | Status reflects in DB after webhook | P1 | Major | – | `[ ]` |
| TC-SET-064 | Webhook signature verification | Send forged webhook | 401 Invalid signature | P0 | Blocker | ✅ | `[ ]` |
| TC-SET-065 | Webhook idempotency | Replay same event | No duplicate plan change | P1 | Major | – | `[ ]` |
| TC-SET-066 | Quota auto-reset | Wait for 1st of month | `image_used` and `video_used` zeroed; `quota_reset_at` advanced | P1 | Major | – | `[ ]` |

### 10.7 Usage
| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-SET-070 | `/settings/usage` loads | Click | Usage charts render | P1 | Minor | – | `[ ]` |
| TC-SET-071 | LLM usage events log | Generate asset | Row in `llm_usage_events` with token + cost | P1 | Major | – | `[ ]` |

---

## 11. Edge Function security & error handling

| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-SEC-001 | CORS — allowed origin | Origin: `https://gtmengine.qubitlyventures.com` | 200 with `Access-Control-Allow-Origin` echoing origin | P0 | Blocker | ✅ | `[ ]` |
| TC-SEC-002 | CORS — localhost | Origin: `http://localhost:3000` | 200 | P0 | Blocker | – | `[ ]` |
| TC-SEC-003 | CORS — disallowed origin | Origin: `https://evil.com` | 403 | P0 | Blocker | ✅ | `[ ]` |
| TC-SEC-004 | OPTIONS preflight | OPTIONS request | Returns 204 with allowed methods/headers | P0 | Major | – | `[ ]` |
| TC-SEC-005 | Body size limit | POST 2 MB body | 413 Payload Too Large | P1 | Major | – | `[ ]` |
| TC-SEC-006 | Missing required field | POST `{}` to `generate-asset` | 400 with `{error: "..."}` | P0 | Major | ✅ | `[ ]` |
| TC-SEC-007 | SQL injection in field | Send `'; DROP TABLE …` as subject | Stored as literal text, no SQL exec | P0 | Blocker | ✅ | `[ ]` |
| TC-SEC-008 | XSS in caption | Submit `<script>alert(1)</script>` | Rendered as text, not executed | P0 | Blocker | ✅ | `[ ]` |
| TC-SEC-009 | Stack trace in error | Trigger 500 (e.g. malformed JSON) | Response is `{error: "..."}`, no stack | P0 | Blocker | ✅ | `[ ]` |
| TC-SEC-010 | No PII in logs | Generate asset | Supabase function logs do not contain JWT, decrypted key, or full body | P0 | Blocker | – | `[ ]` |
| TC-SEC-011 | Rate limit — generation | Call `generate-asset` 100x in 60s | 429 after quota | P1 | Major | – | `[ ]` |
| TC-SEC-012 | Rate limit — mutating fns | Call `update-org-settings` 100x in 60s | 429 after 60 (per spec rule 11) | P1 | Major | – | `[ ]` |
| TC-SEC-013 | Cron-only function w/o secret | Call `ingest-signals` w/o `X-Cron-Secret` | 401 | P0 | Blocker | ✅ | `[ ]` |
| TC-SEC-014 | Public-facing fn w/o JWT | Call `generate-asset` w/ no Authorization header | 401 | P0 | Blocker | ✅ | `[ ]` |
| TC-SEC-015 | Webhook public, signature OK | Send valid Dodo webhook | 200 | P0 | Blocker | ✅ | `[ ]` |
| TC-SEC-016 | Webhook signature bad | Tamper signature byte | 401 | P0 | Blocker | ✅ | `[ ]` |
| TC-SEC-017 | Encryption key missing | Restart fn w/o `ENCRYPTION_KEY` env (do not actually do this in prod — verify code path) | Function refuses to start / returns 500 | P1 | Major | – | `[ ]` |
| TC-SEC-018 | Storage bucket private | curl `https://…/storage/v1/object/assets/<file>` w/o token | 401 | P0 | Blocker | ✅ | `[ ]` |
| TC-SEC-019 | Signed URL expired | Wait 65 min after sign | 403 expired | P1 | Major | – | `[ ]` |
| TC-SEC-020 | Service-role key not in client bundle | Search `apps/web/.next` build for service role key | Not found | P0 | Blocker | – | `[ ]` |

---

## 12. Cross-cutting — Observability

| ID | Title | Steps | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|---|
| TC-OBS-001 | Sentry — frontend error | Throw test error in console | Appears in Sentry within 30s | P1 | Major | – | `[ ]` |
| TC-OBS-002 | Sentry — Edge fn error | Trigger 500 in `generate-asset` | Captured | P1 | Major | – | `[ ]` |
| TC-OBS-003 | Langfuse — LLM trace | Generate asset | Trace + spans in Langfuse with prompt + cost | P1 | Major | – | `[ ]` |
| TC-OBS-004 | Cost tracking | Generate 5 images | `llm_usage_events.cost_usd` populated and matches Langfuse | P1 | Major | – | `[ ]` |
| TC-OBS-005 | No PII in Sentry breadcrumbs | Generate asset | Search Sentry for email/JWT — none present | P0 | Major | – | `[ ]` |

---

## 13. Mobile responsiveness (post-fix verification)

Run on actual device (iPhone Safari + Android Chrome) at 375 × 812.

| ID | Title | Expected | P | Sev | @demo | Status |
|---|---|---|---|---|---|---|
| TC-MOB-001 | Hamburger opens drawer | Drawer slides in, overlay darkens | P0 | Blocker | ✅ | `[ ]` |
| TC-MOB-002 | Drawer auto-close on nav | Tap a nav item → drawer closes after route change | P0 | Major | ✅ | `[ ]` |
| TC-MOB-003 | "Sign out" visible at bottom of drawer | Scroll inside drawer if needed; sign out reachable | P0 | Major | ✅ | `[ ]` |
| TC-MOB-004 | iOS-style top bar visible | Title centered, hamburger or back left | P0 | Major | ✅ | `[ ]` |
| TC-MOB-005 | Back button on nested route | Visit `/campaigns/[id]` → "Back" appears | P0 | Major | ✅ | `[ ]` |
| TC-MOB-006 | No horizontal scroll on /dashboard | Scroll up/down only | P0 | Major | ✅ | `[ ]` |
| TC-MOB-007 | No horizontal scroll on /create | Same | P0 | Major | ✅ | `[ ]` |
| TC-MOB-008 | No horizontal scroll on /campaigns | Filter chips scroll horizontally inside their bar; outer page does not | P0 | Major | ✅ | `[ ]` |
| TC-MOB-009 | Social copy "Ready" + "Regenerate all" visible | Text not greyed/invisible (dark class on html) | P0 | Major | ✅ | `[ ]` |
| TC-MOB-010 | Tables scroll horizontally | `/icp` table | Inner scroll, not page scroll | P0 | Major | – | `[ ]` |
| TC-MOB-011 | Touch targets ≥ 36px | Visual inspect on dashboard | Buttons easy to tap | P1 | Minor | – | `[ ]` |
| TC-MOB-012 | Asset preview fits screen | `/create/[job_id]` image | Width 100%, no overflow | P0 | Major | ✅ | `[ ]` |
| TC-MOB-013 | Drawer respects safe-area inset | iPhone with home gesture bar | Sign out not under bar | P1 | Minor | – | `[ ]` |
| TC-MOB-014 | Settings sub-pages OK | `/settings/team`, `/settings/billing`, `/settings/models` | All readable, no overflow | P1 | Major | – | `[ ]` |
| TC-MOB-015 | Onboarding wizard on mobile | Complete onboarding from phone | All steps work | P1 | Major | – | `[ ]` |
| TC-MOB-016 | Desktop unchanged | Open same pages on 1440px | Pixel-identical to before mobile push | P0 | Blocker | ✅ | `[ ]` |

---

## 14. End-to-end client journey (the demo path)

This is the single flow that MUST work end-to-end for the demo.

| ID | Step | Expected | Status |
|---|---|---|---|
| TC-E2E-01 | Sign up Org A as `demo@…` | Land on `/onboarding` | `[ ]` |
| TC-E2E-02 | Complete onboarding (name, brand, ICP) | Redirect to `/dashboard`; org saved | `[ ]` |
| TC-E2E-03 | Wait for ingest cron (≤15 min) OR add an RSS feed and trigger manually | `signals` table has fresh rows | `[ ]` |
| TC-E2E-04 | Click a high-score signal on `/dashboard` | Signal detail loads | `[ ]` |
| TC-E2E-05 | Click "Create asset" | `/create?signalId=…` opens with banner | `[ ]` |
| TC-E2E-06 | Fill subject + tags → Generate image | Image renders within 30s | `[ ]` |
| TC-E2E-07 | Captions auto-appear (LinkedIn, Twitter, etc.) | All 4-5 platforms populated | `[ ]` |
| TC-E2E-08 | Click "Use for campaign" | Pre-fills campaign new | `[ ]` |
| TC-E2E-09 | Add 2-3 prospects from ICP | Rows added | `[ ]` |
| TC-E2E-10 | Generate per-prospect copies | All copies render | `[ ]` |
| TC-E2E-11 | Open one prospect → personalise | Personal email body generated | `[ ]` |
| TC-E2E-12 | Copy email to clipboard, paste into Gmail | Lands as plain text, no broken markup | `[ ]` |
| TC-E2E-13 | Sign out → sign back in | Lands on `/dashboard`, all data still there | `[ ]` |
| TC-E2E-14 | View `/library` | All generated assets visible | `[ ]` |
| TC-E2E-15 | Same flow on mobile (use phone for one rep) | Demoable end-to-end | `[ ]` |

---

## 15. Demo-critical subset (47 cases)

Filter the document for `@demo`. These MUST be green:

`TC-AUTH-001 / 002 / 003 / 006 / 010 / 011 / 016 / 023`  
`TC-ONB-001 / 002 / 008 / 010`  
`TC-SIG-001 / 009 / 011 / 015 / 020 / 021 / 022 / 023`  
`TC-CRE-001 / 002 / 003 / 004 / 005 / 009 / 012 / 020 / 021 / 023 / 024`  
`TC-LIB-001 / 003`  
`TC-ICP-001 / 002 / 004 / 010 / 020 / 021`  
`TC-CMP-001 / 003 / 004 / 005 / 006 / 007`  
`TC-SET-001 / 020 / 025 / 040 / 041 / 042 / 061 / 062 / 064`  
`TC-SEC-001 / 003 / 006 / 007 / 008 / 009 / 013 / 014 / 015 / 016 / 018`  
`TC-MOB-001 / 002 / 003 / 004 / 005 / 006 / 007 / 008 / 009 / 012 / 016`  
`TC-E2E-01 → TC-E2E-15`

---

## 16. Known issues / accepted risks

| # | Item | Owner | Decision |
|---|---|---|---|
| 1 | `pg_net` extension in `public` schema | Backend | Accept for now, move post-handoff |
| 2 | `current_org_id` function search_path mutable | Backend | Fix in next migration |
| 3 | Auth leaked-password protection (HIBP) disabled | Ops | **Enable before handoff** |
| 4 | 4 unindexed FKs (low rows currently) | Backend | Add indexes in next migration |
| 5 | RLS init-plan re-evaluation | Backend | Refactor to `(select auth.…())` post-demo |
| 6 | `typescript.ignoreBuildErrors=true` in `next.config.mjs` | Frontend | Regenerate Supabase types, then remove |
| 7 | Local Windows build hits paging file error | Local-dev only | Cloudflare deploy unaffected |

---

## 17. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Engineering | | | |
| QA | | | |
| Product | | | |
| Client lead | | | |

---

## Appendix A — Verification scripts

- **`testing/security-verification.sql`** — runnable in Supabase SQL editor; verifies RLS policy presence, table-level RLS enabled, cron job activeness, storage bucket privacy, and indexes on hot columns.
- **`testing/security-verification.ps1`** — PowerShell + curl checks: CORS allow/deny, JWT-required endpoints, cron-secret-required endpoints, webhook signature, body size limit, signed-URL expiry.

Run order:
```powershell
# DB-side checks
# (paste contents of testing/security-verification.sql into Supabase SQL editor)

# Network-side checks
.\testing\security-verification.ps1 -BaseUrl https://gtmengine.qubitlyventures.com -SupabaseUrl https://ycsfossrrntwhegmyrze.supabase.co
```
