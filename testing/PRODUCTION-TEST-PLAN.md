# GTM Engine — Production Test Plan

**Version:** 1.0  
**Date:** 2026-05-11  
**Audience:** Engineering team + enterprise client sign-off  
**Purpose:** Define the complete test strategy, coverage targets, tooling, and execution steps required before the system goes live with enterprise clients.

---

## Table of Contents

1. [Scope](#1-scope)
2. [Test Levels](#2-test-levels)
3. [Prerequisites & Setup](#3-prerequisites--setup)
4. [What You Need to Provide](#4-what-you-need-to-provide)
5. [Phase 1 — Unit Tests](#5-phase-1--unit-tests)
6. [Phase 2 — Integration Tests](#6-phase-2--integration-tests)
7. [Phase 3 — Local E2E Smoke Tests (Docker)](#7-phase-3--local-e2e-smoke-tests-docker)
8. [Phase 4 — Security & Compliance Tests](#8-phase-4--security--compliance-tests)
9. [Phase 5 — Performance & Load Tests](#9-phase-5--performance--load-tests)
10. [Phase 6 — Production Smoke Tests](#10-phase-6--production-smoke-tests)
11. [Coverage Targets](#11-coverage-targets)
12. [CI/CD Pipeline](#12-cicd-pipeline)
13. [Go / No-Go Checklist](#13-go--no-go-checklist)
14. [Open Items Blocking Production](#14-open-items-blocking-production)

---

## 1. Scope

The following features are in scope for production readiness testing:

| Feature | Edge Functions | Frontend Routes |
|---------|---------------|-----------------|
| **Auth & Org** | `create-org`, `accept-invite`, `invite-user`, `remove-member` | `/auth/*`, `/onboarding/*` |
| **Brand Onboarding** | `save-onboarding` | `/onboarding/*` |
| **Signal Ingestion** | `ingest-signals`, `archive-old-signals`, `cleanup-apify-signals` | — (cron) |
| **Trend Dashboard** | — (direct DB) | `/dashboard` |
| **Content Creation** | `build-prompt`, `generate-asset`, `poll-job-status`, `check-quota`, `submit-feedback`, `generate-captions`, `delete-asset`, `get-upload-url` | `/create`, `/create/[job_id]`, `/library` |
| **ICP Discovery** | `icp-enrich`, `personalise`, `generate-campaign-brief` | `/icp`, `/icp/[id]/personalise` |
| **Campaigns** | `create-campaign`, `update-campaign`, `add-campaign-prospects`, `campaign-chat`, `generate-campaign-brief` | `/campaigns` |
| **LinkedIn** | `save-linkedin-connection`, `delete-linkedin-connection`, `get-linkedin-posts`, `post-to-linkedin` | `/settings/integrations` |
| **Settings** | `update-org-settings`, `save-data-source-key`, `delete-data-source-key`, `save-model-preferences`, `save-provider-keys`, `delete-provider-key`, `get-available-models`, `get-usage-stats` | `/settings/*` |
| **Billing** | `create-checkout-session`, `dodopayments-webhook` | `/settings/billing` |
| **Team** | `invite-user`, `remove-member` | `/settings/team` |

**Out of scope for v1 testing:** Steps 5–6 (Nurture & Engage, Proposal Generator), CRM integrations, mobile, public API.

---

## 2. Test Levels

```
┌─────────────────────────────────────────────────────────┐
│  Phase 6: Production Smoke Tests  (live system, read-only)
├─────────────────────────────────────────────────────────┤
│  Phase 5: Performance / Load Tests  (k6, local stack)
├─────────────────────────────────────────────────────────┤
│  Phase 4: Security & Compliance     (OWASP, RLS, JWT)
├─────────────────────────────────────────────────────────┤
│  Phase 3: Local E2E Smoke Tests     (Docker + supabase start)
├─────────────────────────────────────────────────────────┤
│  Phase 2: Integration Tests         (mocked DB + providers)
├─────────────────────────────────────────────────────────┤
│  Phase 1: Unit Tests                (pure functions, no I/O)
└─────────────────────────────────────────────────────────┘
```

| Phase | Runs in CI | Requires Docker | Requires Real API Keys | Time Estimate |
|-------|-----------|----------------|----------------------|---------------|
| 1 — Unit | ✅ Always | ❌ | ❌ | ~30s |
| 2 — Integration | ✅ Always | ❌ | ❌ | ~2 min |
| 3 — E2E Local | ✅ On PR merge | ✅ | Minimal (1 call) | ~10 min |
| 4 — Security | ✅ Weekly | ✅ | ❌ | ~5 min |
| 5 — Performance | 📋 Manual | ✅ | ❌ | ~30 min |
| 6 — Production Smoke | 📋 Manual post-deploy | ❌ | ✅ Real production | ~15 min |

---

## 3. Prerequisites & Setup

### 3.1 Install Docker Desktop
Required for Phase 3, 4, 5 (local Supabase stack).

1. Download: https://www.docker.com/products/docker-desktop
2. Install and restart your machine
3. Verify: `docker --version` and `docker ps`

### 3.2 Start local Supabase stack
```powershell
cd C:\Users\DVVH3865\Desktop\gtmengine
supabase start
# Runs all 24 migrations automatically
# Outputs: local API URL, anon key, service role key, DB URL, Studio URL
```

Save the output — you need these values in `.env.test`:

```
# .env.test  (git-ignored — NEVER commit this)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
TEST_OPENROUTER_KEY=<real key — minimal usage, 1 call per test run>
TEST_DODO_KEY=dodo_test_<your test key>
ENCRYPTION_KEY=<32-byte hex string for local testing>
CRON_SECRET=test-cron-secret-local
```

### 3.3 Serve Edge Functions locally
```powershell
supabase functions serve --env-file .env.test
# Serves all functions at http://localhost:54321/functions/v1/<name>
```

### 3.4 Install k6 (Phase 5 only)
```powershell
scoop install k6
```

---

## 4. What You Need to Provide

**Before testing can begin, collect these items:**

| Item | Used In | Who Provides |
|------|---------|-------------|
| OpenRouter API key (test account) | Phase 3 E2E — `icp-enrich`, `generate-asset`, `personalise`, `generate-campaign-brief` | You |
| Dodo Payments test key (`dodo_test_...`) | Phase 3 — `create-checkout-session`, webhook tests | You |
| Dodo Payments webhook secret | Phase 3 — `dodopayments-webhook` HMAC validation | You |
| 32-byte `ENCRYPTION_KEY` for local | Phase 3 — `save-provider-keys`, `save-data-source-key` | Generate: `openssl rand -hex 32` |
| fal.ai API key (optional) | Phase 3 — video generation path | You (skip if not testing video) |
| Apify API key (optional) | Phase 3 — LinkedIn signal ingestion | You (skip if not testing LinkedIn signals) |
| NewsAPI key (optional) | Phase 3 — NewsAPI signal source | You |
| A test email address that can receive invites | Phase 3 — `invite-user`, `accept-invite` | You |
| Production Supabase project ref | Phase 6 | You |
| Production service role key (read-only ops only) | Phase 6 | You |

> **RULE:** Never put real production keys in test files. Use `.env.test` which is git-ignored.

---

## 5. Phase 1 — Unit Tests

**Status:** ✅ Already written for ICP module. Need to write for all other modules.

**Runner:** Deno test (Edge Functions) + Jest (Next.js frontend)

### 5.1 Edge Function unit tests to write

Each test file lives next to its `index.ts`.

| Function | Pure Functions to Test | Test File |
|----------|----------------------|-----------|
| `_shared/auth.ts` | `extractOrgId`, `requireRole` role comparison logic | `_shared/auth.test.ts` |
| `_shared/encryption.ts` | `encrypt`, `decrypt` round-trip, `decrypt` on tampered ciphertext | `_shared/encryption.test.ts` |
| `_shared/relevance.ts` | `computeTfIdf`, `scoreSignal` — known input/output pairs | `_shared/relevance.test.ts` |
| `_shared/sources/rss.ts` | `parseRssItem`, `deduplicateItems`, date normalisation | `_shared/sources/rss.test.ts` |
| `_shared/sources/hackernews.ts` | `mapHnItem`, score threshold filter | `_shared/sources/hackernews.test.ts` |
| `_shared/sources/reddit.ts` | `mapRedditPost`, NSFW filter, upvote threshold | `_shared/sources/reddit.test.ts` |
| `_shared/sources/youtube.ts` | `mapYouTubeItem`, duration filter | `_shared/sources/youtube.test.ts` |
| `_shared/sources/github.ts` | `mapGithubRepo`, stars threshold | `_shared/sources/github.test.ts` |
| `_shared/sources/newsapi.ts` | `mapNewsItem`, null-safe fields | `_shared/sources/newsapi.test.ts` |
| `_shared/sources/producthunt.ts` | `mapPHPost`, votes filter | `_shared/sources/producthunt.test.ts` |
| `build-prompt/index.ts` | `assembleContentJob`, tag merging, brand context injection | `build-prompt/build-prompt.test.ts` |
| `check-quota/index.ts` | `isWithinQuota`, `incrementUsage` logic | `check-quota/check-quota.test.ts` |
| `icp-enrich/index.ts` | ✅ Done (29 tests) | `icp-enrich/icp-enrich.test.ts` |
| `personalise/index.ts` | ✅ Done (25 tests) | `personalise/personalise.test.ts` |
| `_shared/enrichment/web_search.ts` | ✅ Done (61 tests) | `_shared/enrichment/web_search.test.ts` |
| `generate-campaign-brief/index.ts` | ✅ Done (34 tests) | `generate-campaign-brief/brief.test.ts` |

**Run all unit tests:**
```powershell
$deno = "$env:USERPROFILE\.deno\bin\deno.exe"
& $deno test --allow-read --allow-env --allow-net supabase/functions/
```

### 5.2 Frontend unit tests to write

**Runner:** Jest + React Testing Library  
**Setup:** `apps/web/package.json` needs `jest`, `@testing-library/react`, `@testing-library/jest-dom`

| Component / Hook | What to Test | Test File |
|-----------------|-------------|-----------|
| `lib/supabase/client.ts` | Client initialises without throwing | `lib/supabase/client.test.ts` |
| `store/useJobStore.ts` | Zustand store transitions: `pending→complete`, `pending→failed` | `store/useJobStore.test.ts` |
| `components/signals/signal-card.tsx` | `safeUrl` rejects `javascript:`, renders `#` fallback | `components/signals/signal-card.test.tsx` |
| `components/signals/signal-feed.tsx` | Filters reset on date range change | `components/signals/signal-feed.test.tsx` |
| `components/generation/active-generation-jobs.tsx` | Empty state renders, job card renders | `components/generation/active-generation-jobs.test.tsx` |
| `app/(dashboard)/library/page.tsx` | Pending jobs trigger `refetchInterval`, `handleDownload` retries on 403 | `app/(dashboard)/library/page.test.tsx` |

**Setup command:**
```powershell
cd apps/web
npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest ts-jest
```

---

## 6. Phase 2 — Integration Tests

Tests the full HTTP handler flow with mocked Supabase + mocked AI providers. No real network calls.

**Runner:** Deno test  
**Pattern:** Each test creates a fake `Request`, stubs `createServiceClient()` and `fetch`, calls the handler, asserts the `Response`.

### 6.1 Integration test matrix

| Function | Test Scenarios |
|----------|---------------|
| `create-org` | Happy path creates org + owner member; duplicate slug → 409; missing fields → 400; non-owner cannot create second org |
| `save-onboarding` | All 5 sections save; partial save (section 1 only) returns correct step; org_id mismatch → 403 |
| `invite-user` | Owner invites admin → invite row created; member tries to invite → 403; duplicate email → 409 |
| `accept-invite` | Valid token → member row created, token invalidated; expired token → 410; already-used token → 409 |
| `remove-member` | Owner removes admin → success; member tries to remove → 403; cannot remove self (owner) → 400 |
| `generate-asset` | Image path: quota ok → job created → returns job_id; quota exceeded → 429; no model configured → 500 |
| `generate-asset` | Video path: fal.ai called with correct params; poll URL stored in job |
| `poll-job-status` | Pending job returns status; completed job returns signed URL; job not found → 404 |
| `submit-feedback` | Happy path saves thumbs + stars; duplicate feedback → upsert (no 409); missing job_id → 400 |
| `delete-asset` | Owner deletes own asset → storage + DB row removed; another org's asset → 403 |
| `get-upload-url` | Returns signed URL; mime-type not in allowlist → 400 |
| `ingest-signals` | Called without JWT (cron) → succeeds; each source adapter returns normalised signals; dedup works |
| `icp-enrich` | ✅ Partially covered by unit tests; add: JWT missing → 401; body > 1MB → 413 |
| `personalise` | ✅ Partially covered; add: full handler with mocked DB + mocked OpenRouter response |
| `generate-campaign-brief` | Campaign not found → 404; brand not found → 404; happy path returns brief JSON + calls PDF generation |
| `create-checkout-session` | Creates Dodo session; org already subscribed → 409 |
| `dodopayments-webhook` | Valid HMAC + `payment.succeeded` → org plan updated; invalid HMAC → 401; unknown event type → 200 (ignored) |
| `save-provider-keys` | Key encrypted before DB insert; member role → 403 |
| `delete-provider-key` | Key deleted; org_id mismatch → 403 |
| `save-data-source-key` | Key encrypted; invalid source name → 400 |
| `get-available-models` | Returns merged list from DB + hardcoded defaults; admin only |
| `save-model-preferences` | Saves step→model mapping; member role → 403 |
| `check-quota` | Under limit → `{ allowed: true }`; at limit → `{ allowed: false, reason: 'monthly_limit' }` |
| `update-org-settings` | Timezone updated; member role → 403 |
| `campaign-chat` | Returns AI response; missing campaign_id → 400 |
| `create-campaign` | Creates campaign row; missing required fields → 400 |

**Test file location:** `supabase/functions/<name>/<name>.integration.test.ts`

---

## 7. Phase 3 — Local E2E Smoke Tests (Docker)

Requires: Docker Desktop running + `supabase start` + `supabase functions serve`

These are real HTTP calls to `http://localhost:54321/functions/v1/*` against a real local Postgres with all migrations applied. Test data is inserted and cleaned up in each test.

**Runner:** Deno test with `--allow-net`  
**File:** `testing/e2e/smoke.test.ts`

### 7.1 E2E test scenarios (in execution order)

```
Auth & Org Setup
  ✦ POST /auth/v1/signup → creates test user + org
  ✦ POST /functions/v1/create-org → org row + owner member created
  ✦ POST /functions/v1/save-onboarding → all 5 sections saved

Signal Ingestion
  ✦ POST /functions/v1/ingest-signals (with CRON_SECRET header) → signals inserted
  ✦ GET signals via direct DB query → signals have correct scores, org_id

Content Creation
  ✦ POST /functions/v1/build-prompt → returns ContentJob JSON
  ✦ POST /functions/v1/check-quota → returns { allowed: true }
  ✦ POST /functions/v1/generate-asset (image) → returns job_id, status='pending' or 'complete'
  ✦ POST /functions/v1/poll-job-status → returns signed URL when complete
  ✦ POST /functions/v1/submit-feedback → thumbs + stars saved
  ✦ POST /functions/v1/generate-captions → captions per platform returned
  ✦ GET /functions/v1/get-upload-url → returns signed upload URL

ICP
  ✦ POST /functions/v1/icp-enrich → prospects inserted, scores 0–1
  ✦ POST /functions/v1/personalise → copy_text returned, prospect status = 'contacted'
  ✦ POST /functions/v1/generate-campaign-brief → brief JSON + PDF URL returned

Campaigns
  ✦ POST /functions/v1/create-campaign → campaign_id returned
  ✦ POST /functions/v1/add-campaign-prospects → prospects linked to campaign
  ✦ POST /functions/v1/update-campaign → status updated
  ✦ POST /functions/v1/campaign-chat → AI response returned

Team Management
  ✦ POST /functions/v1/invite-user → invite row created, email queued
  ✦ POST /functions/v1/accept-invite (second test user) → member row created
  ✦ POST /functions/v1/remove-member → member removed

Settings
  ✦ POST /functions/v1/save-provider-keys → key encrypted in DB
  ✦ POST /functions/v1/delete-provider-key → key removed
  ✦ POST /functions/v1/save-data-source-key → encrypted key stored
  ✦ POST /functions/v1/save-model-preferences → preference saved
  ✦ GET /functions/v1/get-available-models → model list returned
  ✦ GET /functions/v1/get-usage-stats → usage counters returned
  ✦ POST /functions/v1/update-org-settings → timezone + name updated

Billing
  ✦ POST /functions/v1/create-checkout-session → Dodo session URL returned
  ✦ POST /functions/v1/dodopayments-webhook (simulated HMAC-signed payload) → plan updated

Cleanup
  ✦ DELETE test org, users, all inserted rows
```

### 7.2 Run command
```powershell
$deno = "$env:USERPROFILE\.deno\bin\deno.exe"
& $deno test --allow-net --allow-env --allow-read testing/e2e/smoke.test.ts
```

---

## 8. Phase 4 — Security & Compliance Tests

These verify the non-negotiable security rules from the spec. Automated where possible.

| Test | Rule Being Verified | Pass Criteria |
|------|-------------------|---------------|
| JWT-less request to every Edge Function | RULE: JWT required on all user-facing functions | All return 401 |
| Request with `org_id` in body (not JWT) | RULE: org_id never from body | Returns data for JWT's org, not body's org |
| Cron functions called with user JWT | RULE: cron functions don't use JWT | Should still work (no JWT check) |
| `dodopayments-webhook` with wrong HMAC | RULE: HMAC is the auth | Returns 401 |
| `dodopayments-webhook` without JWT | RULE: public endpoint | Returns 200/processed (not 401) |
| Member role calling admin-only endpoint | RULE: requireRole enforced | Returns 403 |
| CORS: request from `https://evil.com` | RULE: only 2 origins allowed | Returns 403 |
| CORS: request from `https://gtmengine.qubitlyventures.com` | Allowed origin | Returns 200 with CORS headers |
| Body > 1MB sent to every function | RULE: 413 on oversized body | All return 413 |
| `javascript:` URL in signal card | XSS guard: `safeUrl` | Renders `href="#"` not `javascript:` |
| Encrypted key in DB — readable as ciphertext only | RULE: AES-256-GCM encryption | Raw DB column is not the plaintext key |
| RLS: user queries another org's data via direct DB | RULE: RLS org isolation | Returns 0 rows |
| Stack trace in error response | RULE: never expose stack traces | Error responses contain only `{ error: '...' }` |
| Storage bucket public access | RULE: no public buckets | Direct URL without signed token → 403 |
| Rate limit: 61 requests in 1 minute | RULE: 60 req/min per org | 61st request returns 429 |

**File:** `testing/security/security.test.ts`  
**Run command:**
```powershell
& $deno test --allow-net --allow-env testing/security/security.test.ts
```

---

## 9. Phase 5 — Performance & Load Tests

**Runner:** k6  
**Target:** Local Supabase stack (not production)

### 9.1 Scenarios

| Scenario | VUs | Duration | Target | Pass Criteria |
|----------|-----|----------|--------|---------------|
| Dashboard signal feed (read) | 50 | 60s | `/dashboard` page load | p95 < 500ms |
| Concurrent asset generation | 10 | 120s | `POST /generate-asset` | p95 < 3s, 0 errors |
| Concurrent ICP enrichment | 5 | 60s | `POST /icp-enrich` | p95 < 10s |
| Concurrent personalise | 20 | 60s | `POST /personalise` | p95 < 5s |
| Signal ingestion at scale | 1 | 1 run | `POST /ingest-signals` (100 signals) | Completes < 30s |

**File:** `testing/performance/load.js`  
**Run command:**
```powershell
k6 run testing/performance/load.js
```

---

## 10. Phase 6 — Production Smoke Tests

Run **after every production deployment**. Read-mostly — minimal writes, full cleanup.

> ⚠️ Use a **dedicated QA org** on production, not a real client org. Create it once and leave it.

| Scenario | Expected Result |
|----------|----------------|
| Login with QA user → JWT received | ✅ |
| Dashboard loads → signals visible | ✅ |
| `GET /functions/v1/get-available-models` | Returns model list |
| `POST /functions/v1/check-quota` | Returns `{ allowed: true }` for QA org |
| `POST /functions/v1/icp-enrich` (max_results: 1) | Returns 1 prospect, icp_score 0–1 |
| `GET /functions/v1/get-usage-stats` | Returns usage counters |
| `POST /functions/v1/create-checkout-session` | Returns Dodo checkout URL (test mode) |
| Library page loads → signed URLs resolve | ✅ |
| Settings → models page loads | ✅ |

**Script:** `testing/production/prod-smoke.ps1`

---

## 11. Coverage Targets

| Layer | Current | Target |
|-------|---------|--------|
| Edge Function pure functions | ~95% (ICP only) | **≥ 90% all modules** |
| Edge Function HTTP handlers | ~35% (ICP only) | **≥ 75% (integration tests)** |
| Frontend components | 0% | **≥ 70%** |
| Security rules | 0% automated | **100% of RULE items** |
| E2E happy paths | 0% | **100% of critical paths** |

---

## 12. CI/CD Pipeline

Add these jobs to `.github/workflows/test.yml`:

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: denoland/setup-deno@v1
        with: { deno-version: v2.x }
      - run: deno test --allow-read --allow-env --allow-net supabase/functions/

  frontend-unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd apps/web && npm ci && npm test

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - run: deno test --allow-all supabase/functions/**/*.integration.test.ts

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    services:
      # supabase local stack via Docker
    steps:
      - run: supabase start
      - run: supabase functions serve &
      - run: deno test --allow-all testing/e2e/smoke.test.ts

  security-tests:
    runs-on: ubuntu-latest
    needs: e2e-tests
    steps:
      - run: deno test --allow-all testing/security/security.test.ts
```

---

## 13. Go / No-Go Checklist

All items must be ✅ before going live with enterprise clients:

### Code Quality
- [ ] All Phase 1 unit tests written and passing (≥ 90% coverage)
- [ ] All Phase 2 integration tests written and passing
- [ ] Zero TypeScript errors (`tsc --noEmit` in `apps/web`)
- [ ] Zero lint errors

### Security (Non-Negotiable)
- [ ] All 15 security test scenarios pass (Phase 4)
- [ ] JWT extracted from `app_metadata.org_id` only — verified in tests
- [ ] All API keys AES-256-GCM encrypted in DB — verified in tests
- [ ] `dodopayments-webhook` HMAC validation tested + passing
- [ ] No stack traces in any error response — verified in tests
- [ ] All Storage buckets confirmed private
- [ ] CORS: only 2 allowed origins — verified in tests
- [ ] Rate limiting active on all user-facing endpoints

### Functionality
- [ ] Phase 3 E2E smoke tests 100% passing on local stack
- [ ] Signal ingestion working for ≥ 3 sources (RSS, HackerNews, Reddit minimum)
- [ ] Image generation end-to-end working (OpenRouter → Storage → signed URL)
- [ ] Video generation end-to-end working (fal.ai → poll → email notification)
- [ ] ICP enrichment returning prospects with scores
- [ ] Campaign brief PDF generated and downloadable
- [ ] Billing checkout session + webhook plan update working (Dodo test mode)

### Infrastructure
- [ ] All 24 migrations applied on production — `supabase migration list` shows all applied
- [ ] `pgvector` extension enabled — `SELECT * FROM pg_extension WHERE extname = 'vector'`
- [ ] `pg_cron` jobs active — `SELECT * FROM cron.job`
- [ ] Storage buckets created: `generation-assets`, `campaign-briefs`, `brand-assets`
- [ ] Sentry DSN configured and catching errors
- [ ] Langfuse configured for AI call tracing

### Performance
- [ ] Dashboard p95 load < 500ms (Phase 5)
- [ ] Asset generation p95 < 3s for images
- [ ] No N+1 queries in signal feed (EXPLAIN ANALYZE checked)

### Phase 6 Production Smoke
- [ ] Production smoke test script runs clean against prod QA org

---

## 14. Open Items Blocking Production

| ID | Issue | Severity | Owner |
|----|-------|----------|-------|
| PROD-001 | Monthly run cap enforcement disabled (`false &&` guard in `icp-enrich`) | Medium — cost risk | Engineering |
| PROD-002 | No CI/CD pipeline (`test.yml`) exists yet | High — no automated gates | Engineering |
| PROD-003 | Frontend unit test suite not set up (no Jest config in `apps/web`) | High — frontend untested | Engineering |
| PROD-004 | Phase 1 unit tests exist only for ICP module — 12 other modules need tests | High | Engineering |
| PROD-005 | Phase 2 integration tests: 0 written | High — handlers untested | Engineering |
| PROD-006 | Docker Desktop not installed — blocks Phase 3, 4, 5 | Blocker (install required) | You |
| PROD-007 | `.env.test` not created — API keys needed for E2E | Blocker | You (see §4) |
| PROD-008 | Deno version on machine is 1.29.2 (Jan 2023) — recommend upgrading to 2.x | Medium | Engineering |
| PROD-009 | Rate limiting implementation not confirmed on all 35 Edge Functions | High — OWASP rule | Engineering |
| PROD-010 | Production QA org not created | Medium — needed for Phase 6 | You |

---

## Execution Order

```
Week 1  →  Install Docker, create .env.test, upgrade Deno
           Write Phase 1 unit tests for all remaining modules
           Set up Jest in apps/web, write frontend unit tests

Week 2  →  Write Phase 2 integration tests for all 35 functions
           Fix PROD-001 (run cap enforcement)
           Create CI pipeline (test.yml)

Week 3  →  Phase 3 E2E smoke tests on local stack
           Phase 4 security tests
           Fix any failures found

Week 4  →  Phase 5 performance tests
           Fix any p95 regressions
           Phase 6 production smoke test
           Go / No-Go review
```
