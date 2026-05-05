# GTM Engine — Testing

This folder is the single home for all QA, security, and pre-handoff verification artifacts. Use it for every future testing cycle.

## Contents

| File | Purpose |
|---|---|
| [TESTING.md](TESTING.md) | Master test plan — ~210 cases across auth/RLS, onboarding, signals, generation, ICP, campaigns, settings, billing, edge fn security, observability, mobile, and full E2E client journey. Each case has ID, P0/P1/P2 priority, severity, `@demo` tag, and a status checkbox. |
| [security-verification.sql](security-verification.sql) | 12 read-only SQL checks: RLS coverage, CRUD policy completeness, cron health, storage privacy, encrypted-at-rest spot check, hot-path indexes, cross-tenant smoke, quota integrity, stale jobs, `SECURITY DEFINER` `search_path`, default-model-per-step. Paste into Supabase SQL editor or run via the Supabase MCP. |
| [security-verification.ps1](security-verification.ps1) | 21 network probes: CORS allow/deny, JWT-required endpoints, the 8 self-validating fns, cron-secret enforcement, webhook signature, body-size cap, storage privacy, security headers, no service-role key in client HTML. PowerShell 5.1 compatible. |
| `FINDINGS-YYYY-MM-DD.md` | One file per test run. Records date, environment, results table, hardening items, action plan, sign-off. See `FINDINGS-2026-05-05.md` for the template. |

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
