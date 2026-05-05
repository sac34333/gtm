# Answer Engine Optimization (AEO) — Future Feature Spec

> **Status:** Backlog. Not on the current roadmap. Captured here so we can pick it up cleanly later.
> **Inspired by:** [HubSpot AEO](https://www.hubspot.com/products/aeo) (launched Beta, ₹4,170/mo / ~$50).
> **One-liner:** *See how your business shows up in ChatGPT, Gemini, Perplexity (and Claude). Track visibility over time, watch competitors, get prioritized actions to win the answer.*

---

## 1. Why this matters

Buyers increasingly ask AI ("which AI marketing platform should I use?") **before** they ever hit a website. If your brand isn't named in the answer, you're filtered out before you knew you were in the running. AEO measures and improves that visibility.

This is a **natural fit for GTM Engine** because:
- It reuses our existing multi-LLM router (`_shared/providers/router.ts`)
- It reuses our pg_cron + edge function pattern (`ingest-signals` is the closest analogue)
- It reuses BYOK + encryption (`_shared/encryption.ts`, `org_provider_api_keys`)
- It reuses our quota/billing rails (`check-quota`, Dodo Payments)
- It complements the **signal ingestion** product surface — both are "what's happening in your market"

---

## 2. Core flow (how AEO actually works)

A daily cron does, per org:

1. For each tracked **prompt** (e.g. *"What are the best AI marketing platforms?"*) ...
2. ... and each enabled **engine** (ChatGPT, Gemini, Perplexity, Claude) ...
3. Send the prompt to the engine, capture the **raw answer** + **citations** (source URLs).
4. **Parse mentions:**
   - Exact match on the org's company name + aliases
   - Domain match against the org's domain in the cited URLs
   - Cheap LLM judge ("did this answer recommend Acme? sentiment?") to catch paraphrasing
5. Also detect mentions of every brand in `aeo_competitors`.
6. Write one row per (prompt × engine × day) to `aeo_checks`.
7. Compute aggregates: **visibility score**, **share of voice**, **sentiment**, **citation source mix**.
8. Weekly job rolls up the data and asks Claude/GPT for **prioritized recommendations** ("create a comparison page X vs Y", "pitch outlet Z for a citation").

---

## 3. How it maps onto existing GTM Engine infrastructure

The good news: **~80% of the plumbing already exists**.

| AEO requirement | Existing piece | Gap |
|---|---|---|
| Multi-LLM provider routing | `supabase/functions/_shared/providers/router.ts` (OpenRouter, Anthropic, Google AI Studio, fal) | Add **Perplexity** adapter |
| Daily cron jobs | `pg_cron` setup in `0004_cron_jobs.sql` + the `ingest-signals` pattern | Add `run-aeo-checks` cron + function |
| Per-org config + RLS | Already on every table | Add `aeo_*` tables + standard RLS policies |
| BYOK + key encryption | `_shared/encryption.ts`, `org_provider_api_keys` table | None — reuse as-is |
| Quota / billing | `check-quota` edge function + Dodo Payments | Add an AEO quota line (`aeo_checks_per_month`) |
| Brand context for prompt suggestions | `brand_contexts` table (already has `company_name`, `competitor_names`, `active_themes`, ICP) | None |
| Visibility-over-time UI | `/dashboard` trend chart pattern | Reuse the existing component |
| Observability (cost + latency per call) | `_shared/observability.ts` `recordUsage()` | None — already covers all providers |

So really we add **3 things**: tables, functions, and a UI surface.

---

## 4. Database schema (1 migration)

```sql
-- Migration: 002X_aeo_initial_schema.sql

-- The questions/prompts the org wants to track
CREATE TABLE aeo_prompts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  prompt_text     text NOT NULL CHECK (length(prompt_text) <= 500),
  category        text,                          -- e.g. 'comparison', 'how-to', 'recommendation'
  is_active       boolean NOT NULL DEFAULT true,
  source          text NOT NULL DEFAULT 'manual', -- manual | suggested | auto
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  UNIQUE (org_id, prompt_text)
);

-- Competitors to also detect in answers
CREATE TABLE aeo_competitors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  brand_name      text NOT NULL,
  aliases         text[] NOT NULL DEFAULT '{}',  -- e.g. ['Acme', 'AcmeCorp', 'acme.com']
  domain          text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, brand_name)
);

-- Per-org engine config (which engines are tracked + how often)
CREATE TABLE aeo_engine_config (
  org_id              uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  enabled_engines     text[] NOT NULL DEFAULT ARRAY['chatgpt','gemini','perplexity'],
  check_frequency     text NOT NULL DEFAULT 'daily' CHECK (check_frequency IN ('daily','weekly')),
  judge_model         text DEFAULT 'claude-haiku-4',  -- cheap LLM that scores mentions
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- One row per (prompt × engine × day). Raw answer + parsed mentions.
CREATE TABLE aeo_checks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  prompt_id           uuid NOT NULL REFERENCES aeo_prompts(id) ON DELETE CASCADE,
  engine              text NOT NULL CHECK (engine IN ('chatgpt','gemini','perplexity','claude')),
  checked_at          timestamptz NOT NULL DEFAULT now(),
  answer_text         text NOT NULL,                 -- raw LLM answer
  own_brand_mentioned boolean NOT NULL DEFAULT false,
  own_brand_position  int,                            -- 1 = top recommendation, 2 = second, etc. NULL if not mentioned
  own_brand_sentiment text CHECK (own_brand_sentiment IN ('positive','neutral','negative')),
  competitor_mentions jsonb NOT NULL DEFAULT '[]',    -- [{ brand_name, position, sentiment }, ...]
  cited_domains       text[] NOT NULL DEFAULT '{}',
  raw_metadata        jsonb,                          -- engine-specific extras
  cost_cents          numeric(10,4),
  latency_ms          int
);
CREATE INDEX idx_aeo_checks_org_date ON aeo_checks (org_id, checked_at DESC);
CREATE INDEX idx_aeo_checks_prompt ON aeo_checks (prompt_id, checked_at DESC);

-- Citation breakdown — domain-level rollup, refreshed by cron
CREATE TABLE aeo_citations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  domain          text NOT NULL,
  citation_type   text NOT NULL CHECK (citation_type IN ('owned','earned','peer','review_site','ugc','competitor')),
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  total_citations int NOT NULL DEFAULT 0,
  UNIQUE (org_id, domain)
);

-- Weekly LLM-generated action items
CREATE TABLE aeo_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  recommendation  text NOT NULL,                     -- "Create a comparison page: GTM Engine vs HubSpot"
  rationale       text,                              -- why this matters based on the data
  priority        int NOT NULL CHECK (priority BETWEEN 1 AND 5),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','dismissed')),
  related_prompt_ids uuid[]
);

-- RLS: standard org_isolation_{select,insert,update,delete} on every table.
-- Apply identical pattern as 0002_rls_policies.sql.
```

**Quota line item** — extend `org_usage_logs.event_type` to include `aeo_check`. Each daily run increments by `enabled_prompts × enabled_engines`.

---

## 5. Edge functions

### 5a. `run-aeo-checks` (cron, 06:00 UTC daily)

```
For each org WHERE has active aeo_engine_config:
  For each prompt IN aeo_prompts WHERE is_active:
    For each engine IN org.enabled_engines:
      1. Resolve API key from org_provider_api_keys (BYOK) or platform fallback
      2. Send prompt to engine (NO system prompt — we want the raw default answer)
      3. Parse:
         a. Exact-match scan for own company_name + aliases
         b. Exact-match scan for each aeo_competitors.brand_name + aliases
         c. Extract URLs / domains from the answer (Perplexity returns these natively;
            for ChatGPT/Gemini we use a regex + LLM judge fallback)
         d. Optional cheap-LLM judge call:
            "Did this answer recommend {our_brand}? Sentiment? Position (1=top)?"
      4. INSERT aeo_checks row
      5. UPSERT aeo_citations rows
      6. recordUsage(...) for cost tracking
```

**Critical rules** (per `.github/copilot-instructions.md`):
- Service role client (cron, no JWT)
- Iterates ALL orgs
- Logs to `console.error` only — never log decrypted keys or full answers if they may contain PII
- Idempotent: if a check for (org, prompt, engine, today) already exists, skip

### 5b. `suggest-aeo-prompts` (POST, JWT-protected)

Given the org's `brand_contexts` (industry, product, ICP, competitors), call Claude Sonnet to generate ~25 starter prompts a buyer would actually ask. Returns prompts; user picks which to add.

### 5c. `generate-aeo-recommendations` (cron, weekly Mondays 07:00 UTC)

Pulls last 7 days of `aeo_checks` per org, computes:
- Prompts where competitors mention > our mentions → "create a comparison page"
- Domains we never cite from → "pitch this outlet"
- Sentiment dips → "address negative narrative on X"
- Engine gaps (we win on ChatGPT, lose on Perplexity) → "rewrite landing page in citation-friendly format"

Calls Claude with the structured rollup → writes to `aeo_recommendations` with priority 1-5.

### 5d. `add-aeo-prompt` / `delete-aeo-prompt` / `add-aeo-competitor` / `delete-aeo-competitor`

Standard CRUD edge functions. JWT-protected, org-scoped.

### 5e. New provider adapter: `_shared/providers/perplexity.ts`

Perplexity has an OpenAI-compatible API (`https://api.perplexity.ai/chat/completions`) with extra `citations` array in the response. ~50 lines mirroring `openai.ts`.

Models to expose in `available_models`:
- `sonar` — fast, cheap, default
- `sonar-pro` — better citations, ~3x cost
- `sonar-reasoning` — for complex prompts

---

## 6. Frontend surface

New section: `/app/(dashboard)/aeo/`

| Route | Purpose |
|---|---|
| `/aeo` | Overview dashboard — visibility score gauge, trend chart per engine, top competitors, sentiment ring |
| `/aeo/prompts` | List + add/delete prompts. "Suggest prompts" button calls `suggest-aeo-prompts`. |
| `/aeo/competitors` | Manage tracked brands |
| `/aeo/citations` | Domain breakdown — owned vs earned vs peer vs review-site vs UGC vs competitor |
| `/aeo/recommendations` | Weekly action items, mark done/dismissed |
| `/aeo/prompts/[id]` | Drill into one prompt — see all engine answers over time, side-by-side |
| `/settings/aeo` | Engine selection toggles, judge model, frequency |

UI patterns to reuse from existing app:
- Trend chart from `/dashboard`
- Badge + filter row from `/icp`
- Drill-down panel from `/campaigns/[id]` Prospects & Copy tab

---

## 7. Pricing positioning

HubSpot AEO is **₹4,170/mo (~$50)** for 25 prompts × 3 engines = ~$0.022 per check. Our cost basis on **BYOK** is dramatically lower:

| Item | Cost |
|---|---|
| 25 prompts × 3 engines × 30 days | 2,250 checks/month |
| Avg answer cost (per engine) | ~$0.0005 |
| LLM judge cost (Haiku) | ~$0.0002 per check |
| **Total raw API cost / org / month** | **~$1.50–4** |

Two pricing lanes:

| Lane | Price | Who pays for AI |
|---|---|---|
| **BYOK** | $20/mo flat | Customer (their OpenAI/Gemini/Perplexity keys) |
| **Platform-paid** | $35/mo | We do (BYOK is still 30% cheaper but easier sale) |

Either lane is meaningfully cheaper than HubSpot at $50/mo and the **margin on platform-paid is ~10x**. Add weekly recommendations + Claude as a 4th engine as differentiators.

---

## 8. Build order (when we pick this up)

**Phase 1 — MVP (~1 week):**
- Migration (5 tables + RLS)
- `_shared/providers/perplexity.ts`
- `run-aeo-checks` (ChatGPT + Gemini + Perplexity, no judge LLM yet — exact match only)
- `add-aeo-prompt` / `delete-aeo-prompt` (CRUD)
- `/aeo` dashboard + `/aeo/prompts` page
- pg_cron schedule

**Phase 2 — Production (~1 week):**
- `suggest-aeo-prompts` (LLM-generated starter prompts from brand context)
- LLM judge for paraphrased mentions + sentiment
- Citation parsing + domain rollup → `/aeo/citations`
- Competitors module → `/aeo/competitors`
- `generate-aeo-recommendations` weekly cron + `/aeo/recommendations`
- Quota integration in `check-quota`
- Dodo Payments add-on price

**Phase 3 — Polish:**
- Add Claude as a 4th engine
- Visibility-drop alerts (email + in-app)
- Content-type breakdown ("listicle vs comparison vs blog")
- Engine-specific recommendations ("you're losing on Perplexity — they prefer cited blog posts")
- Public-facing pricing page comparison vs HubSpot

---

## 9. Open questions to resolve before building

1. **Engine set on launch:** ChatGPT + Gemini + Perplexity (match HubSpot) vs include Claude (we already wire Anthropic)?
2. **Pricing model:** BYOK $20/mo, platform-paid $35/mo, or both lanes?
3. **Quota tier:** start with 25 prompts × 3 engines like HubSpot, or differentiate with 50 × 4?
4. **Recommendation engine:** Claude or our default text model? (Recommendation quality matters more than cost here.)
5. **Brand mention judge:** cheap LLM call per check (high accuracy, ~$0.0002 each) or pure regex (free, lower accuracy)?
6. **Prompt suggestion source:** brand_contexts only, or also pull from `signals` (what's actually trending in the org's space)?

---

## 10. Risks & considerations

- **Provider ToS:** OpenAI, Google, and Anthropic all permit programmatic access via paid API. Perplexity API is public. **Web-scraping ChatGPT.com / gemini.google.com is NOT compliant** — we must stay on official paid APIs. (HubSpot AEO does the same.)
- **Rate limits:** 25 prompts × 4 engines × N orgs could hit rate limits at scale. Spread the daily cron across the 24h window with `pg_cron` schedules per org-bucket.
- **Answer non-determinism:** LLM answers vary day-to-day even with same prompt + temperature 0. This is a **feature**, not a bug — visibility is a moving target. Always store raw answer for audit.
- **Prompt drift:** ChatGPT's "what are the best X" answer in 2026 ≠ same answer in 2027. The trend line is the value, not any single check.
- **PII in answers:** unlikely (brand prompts are abstract) but the answer text is stored — exclude it from any analytics export.

---

## Appendix: relevant existing files when we build this

- [`supabase/functions/_shared/providers/router.ts`](../../supabase/functions/_shared/providers/router.ts) — extend `routeTextGeneration` to accept new step keys: `aeo_check`, `aeo_judge`, `aeo_recommendation`, `aeo_prompt_suggestion`
- [`supabase/functions/_shared/observability.ts`](../../supabase/functions/_shared/observability.ts) — `recordUsage` already handles new step keys; no change
- [`supabase/functions/_shared/encryption.ts`](../../supabase/functions/_shared/encryption.ts) — used as-is for any new platform-side keys
- [`supabase/functions/ingest-signals/`](../../supabase/functions/ingest-signals/) — closest pattern for `run-aeo-checks` (multi-source, multi-org, cron-driven, service-role)
- [`supabase/functions/check-quota/`](../../supabase/functions/check-quota/) — extend with `aeo_check` event type
- [`supabase/functions/dodopayments-webhook/`](../../supabase/functions/dodopayments-webhook/) — add AEO add-on product
- [`apps/web/app/(dashboard)/dashboard/`](../../apps/web/app/(dashboard)/dashboard/) — trend chart pattern to reuse

---

*Captured: 2026-05-05. Re-evaluate after Week 7 retrospective.*
