# GTM Engine — Testing

This folder is the single home for all QA, security, and pre-handoff verification artifacts. Use it for every future testing cycle.

---

## Objective

Guarantee that every release reaching production clients passes a structured, automated quality gate. No code merges to `main` unless all automated checks are green. No code reaches production unless the live site passes post-deploy smoke tests.

The strategy uses a **staging Supabase project** (separate from production) as the only test environment — no Docker, no local Supabase stack needed.

---

## Current Status — May 2026

### ✅ Done

| What | Detail |
|------|--------|
| **149 unit tests — all passing** | ICP enrich (29), personalise (25), web_search enrichment (61), campaign brief (34) |
| **ICP Tech Spec** | Full OpenAPI-style spec for `icp-enrich`, `personalise`, `generate-campaign-brief` — request/response shapes, all error codes, ICP score algorithm |
| **CI/CD pipeline — PR checks** | `.github/workflows/pr-checks.yml` — runs Unit Tests + E2E Smoke + Security on every PR; blocks merge if any fail |
| **CI/CD pipeline — Deploy** | `.github/workflows/deploy.yml` — on merge to `main`: deploys Edge Functions → Supabase, frontend → Cloudflare Pages, then runs production smoke tests |
| **Security verification scripts** | `security-verification.sql` (12 DB checks) + `security-verification.ps1` (21 network probes) |
| **Production test plan** | `PRODUCTION-TEST-PLAN.md` — 6-phase strategy, coverage targets, go/no-go checklist |

### ⏳ Pending — needs staging project first

| What | Blocked on |
|------|-----------|
| **Staging Supabase project** | You need to create it at supabase.com → provide project ref + anon key + service role key |
| **`testing/e2e/smoke.test.ts`** | Staging project credentials |
| **`testing/security/security.test.ts`** | Staging project credentials |
| **GitHub Actions secrets** | 12 secrets to add in GitHub → Settings → Secrets (list below) |
| **`STAGING_ENABLED = true`** | GitHub → Settings → Variables — flip this after staging is set up to activate Phase 3 + 4 in the pipeline |
| **Unit tests for remaining Edge Functions** | `_shared/auth.ts`, `_shared/encryption.ts`, `build-prompt`, `check-quota`, `ingest-signals`, source adapters |

### ❌ Explicitly out of scope

| What | Why |
|------|-----|
| Integration tests (mocked handlers) | Removed — not needed for this project |
| Performance / load tests (k6) | Deferred to post-client-launch |
| Docker / local Supabase stack | Docker not installed; staging project replaces this |

---

## CI/CD Pipeline (live)

```
Developer opens PR
        ↓
[pr-checks.yml triggers automatically]
        ↓
Phase 1 — Unit Tests (always runs, ~30 sec)
        ↓  pass
Phase 3 — E2E Smoke → Staging    Phase 4 — Security → Staging
        ↓  both pass
GitHub allows PR to be merged
        ↓
[deploy.yml triggers automatically on merge]
        ↓
Deploy Edge Functions → Production Supabase
Deploy Frontend → Cloudflare Pages
        ↓
Phase 6 — Production Smoke Tests
        ↓  pass = release complete   fail = GitHub marks deploy as failed + alerts
```

**Workflow files:** [.github/workflows/pr-checks.yml](../.github/workflows/pr-checks.yml) · [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)

---

## GitHub Secrets required (add once)

Go to: **GitHub repo → Settings → Secrets and variables → Actions**

| Secret | Source |
|--------|--------|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| `PROD_SUPABASE_PROJECT_REF` | Production project → Settings |
| `PROD_SUPABASE_URL` | Production project → Settings → API |
| `PROD_SUPABASE_ANON_KEY` | Production project → Settings → API |
| `PROD_SUPABASE_SERVICE_ROLE_KEY` | Production project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `PROD_SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `PROD_SUPABASE_ANON_KEY` |
| `STAGING_SUPABASE_URL` | Staging project → Settings → API |
| `STAGING_SUPABASE_ANON_KEY` | Staging project → Settings → API |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | Staging project → Settings → API |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar |

Add one **Variable** (not a secret): `STAGING_ENABLED = true` — set this after staging is ready to activate Phase 3 + 4 in the pipeline.

---

## What needs to happen next (in order)

1. **You** — create staging Supabase project at supabase.com
2. **You** — share staging project ref + anon key + service role key
3. **Agent** — writes `testing/e2e/smoke.test.ts` and `testing/security/security.test.ts`
4. **You** — add all 12 GitHub secrets + set `STAGING_ENABLED = true`
5. **Agent** — writes unit tests for remaining Edge Functions
6. Pipeline is fully operational for all future client releases

---

## Files

| File | Status | Purpose |
|------|--------|---------|
| [TESTING.md](TESTING.md) | ✅ Live | Master test plan — ~210 cases across auth/RLS, onboarding, signals, generation, ICP, campaigns, settings, billing, edge fn security, observability, mobile, and full E2E client journey. |
| [PRODUCTION-TEST-PLAN.md](PRODUCTION-TEST-PLAN.md) | ✅ Live | 6-phase strategy, coverage targets, go/no-go checklist, open blocking items. |
| [ICP-TECH-SPEC.md](ICP-TECH-SPEC.md) | ✅ Live | OpenAPI-style spec for `icp-enrich`, `personalise`, `generate-campaign-brief` — request/response shapes, all error codes, ICP score algorithm. |
| [ICP-TESTING.md](ICP-TESTING.md) | ✅ Live | 149 unit test coverage map, what's tested/not tested, test run history. |
| [security-verification.sql](security-verification.sql) | ✅ Live | 12 read-only SQL checks: RLS coverage, cron health, storage privacy, cross-tenant smoke, quota integrity. Paste into Supabase SQL editor. |
| [security-verification.ps1](security-verification.ps1) | ✅ Live | 21 network probes: CORS, JWT enforcement, webhook signature, body-size cap, security headers. PowerShell 5.1 compatible. |
| `FINDINGS-YYYY-MM-DD.md` | ✅ Template | One file per test run. See `FINDINGS-2026-05-05.md` for the template. |
| `e2e/smoke.test.ts` | ⏳ Pending | E2E smoke tests against staging. Written once staging project credentials are provided. |
| `security/security.test.ts` | ⏳ Pending | Automated security tests (JWT, RLS, CORS) against staging. |

## How to run a full verification cycle

```powershell
# From project root
cd C:\Users\DVVH3865\Desktop\gtmengine

# 1. SQL checks — paste into Supabase SQL editor (project: ycsfossrrntwhegmyrze)
#    or have an agent execute via Supabase MCP `execute_sql`
notepad .\testing\security-verification.sql

# 2. Network checks
.\testing\security-verification.ps1 `
  -BaseUrl     "https://gtmengine.qubitlyventures.com" `
  -SupabaseUrl "https://ycsfossrrntwhegmyrze.supabase.co" `
  -AnonKey     "<anon-key from Supabase dashboard>"

# 3. Walk through TESTING.md §15 (the @demo subset, 47 cases) for any user-facing release
# 4. Walk through full TESTING.md before handoff or major release
# 5. Save results in a new FINDINGS-YYYY-MM-DD.md
```

## When to run

| Trigger | What to run |
|---|---|
| Before a demo | `@demo` subset in TESTING.md §15 + both verification scripts |
| Before client handoff | Full TESTING.md + both scripts + new FINDINGS file |
| After any migration | `security-verification.sql` + Supabase advisors |
| After Edge Function changes | `security-verification.ps1` |
| After UI changes | TESTING.md §13 (Mobile) + §14 (E2E journey) |
| Post-incident | Full cycle + add new test case for the regression |

## Adding new test cases

Use the existing ID scheme in TESTING.md: `TC-<area>-<n>` where `<area>` is one of `AUTH`, `SEC`, `ONB`, `SIG`, `GEN`, `LIB`, `ICP`, `CAMP`, `SET`, `BILL`, `OBS`, `MOB`, `E2E`, `FE`. Set Priority (P0/P1/P2), Severity, `@demo` tag if pre-demo critical, and start with `[ ]` checkbox.
