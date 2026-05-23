# ICP Feature — Technical Specification

**Version:** 1.0  
**Date:** 2025-05-07  
**Scope:** `icp-enrich`, `personalise`, `generate-campaign-brief` Edge Functions  
**Auth model:** Supabase JWT — `org_id` always extracted from `user.app_metadata.org_id`

---

## Table of Contents

1. [Overview](#overview)
2. [Endpoint: `POST /functions/v1/icp-enrich`](#endpoint-icp-enrich)
3. [Endpoint: `POST /functions/v1/personalise`](#endpoint-personalise)
4. [Endpoint: `POST /functions/v1/generate-campaign-brief`](#endpoint-generate-campaign-brief)
5. [Shared Models](#shared-models)
6. [ICP Score Algorithm](#icp-score-algorithm)
7. [Prospect Enrichment Waterfall](#prospect-enrichment-waterfall)
8. [Security Controls](#security-controls)

---

## 1. Overview

The ICP (Ideal Customer Profile) feature discovers, scores, and personalises outreach to B2B prospects. It comprises three Edge Functions that chain together:

```
icp-enrich  →  prospects table
personalise →  outreach_copies table (per prospect × job)
generate-campaign-brief → campaign_briefs table + PDF attachment
```

All three functions require a valid Supabase JWT. The `org_id` is **never** read from the request body — it is always extracted from `user.app_metadata.org_id`.

---

## 2. Endpoint: `POST /functions/v1/icp-enrich`

### Purpose

Discover, enrich, and score prospects matching an ICP criteria set. Results are upserted to the `prospects` table and logged in `icp_enrichment_runs`.

### Request

**Headers:**

| Header | Required | Value |
|--------|----------|-------|
| `Authorization` | ✅ | `Bearer <supabase_jwt>` |
| `Content-Type` | ✅ | `application/json` |
| `Content-Length` | — | Auto-set by client |

**Body (JSON):**

```typescript
{
  criteria: {
    industries?: string[]      // e.g. ["SaaS", "Fintech"]
    company_sizes?: string[]   // e.g. ["11-50", "51-200"]
    geographies?: string[]     // e.g. ["United Kingdom", "Germany"]
    titles?: string[]          // e.g. ["CEO", "CTO", "Chief Marketing Officer"]
    keywords?: string[]        // e.g. ["AI", "machine learning"]
    domains?: string[]         // e.g. ["acme.com"]
  }
  rescore_only?: boolean       // default: false — skip discovery, recompute scores only
  max_results?: number         // default: plan tier limit (2–500 depending on tier/BYOK)
}
```

**Validation rules:**
- Body size: `Content-Length > 1,048,576` → `413 payload_too_large`
- `criteria` must be an object (all fields optional, but at least one should be set for meaningful results)
- `max_results` is capped at the plan tier's `max_per_run` limit (see §7)

### Response — 200 OK

```typescript
{
  prospects: Prospect[]        // scored prospects (see §5 for Prospect type)
  total: number                // count of prospects returned
  enrichment_sources_used: string[]  // e.g. ["web_search"]
  warning?: string             // optional advisory (e.g. "monthly run cap reached")
  limits: {
    runs: number               // monthly run cap for this org's plan
    max_per_run: number        // prospect cap per single run
  }
}
```

### Response — Error Cases

| HTTP Status | `error` value | Cause |
|-------------|---------------|-------|
| 401 | `invalid_jwt` | Missing, expired, or invalid JWT |
| 400 | `missing_org_id` | `org_id` absent from JWT `app_metadata` |
| 413 | `payload_too_large` | Request body > 1 MB |
| 400 | `criteria_required` | `criteria` field missing from body |
| 429 | `rate_limit_exceeded` | More than 60 requests/minute from this org |
| 503 | `provider_unavailable` | OpenRouter / Perplexity Sonar returned an error |
| 500 | (generic) | Unexpected server error — no stack trace exposed |

### Behaviour: `rescore_only=true`

When `rescore_only=true`:
- No web search or enrichment calls are made
- All existing `prospects` for this org are fetched from DB
- `computeIcpScore(prospect, criteria)` is re-run on each
- Updated scores are saved (`icp_score` column)
- Returns the re-scored prospects

### Plan Tier Limits

| Plan | `runs`/month | `max_per_run` |
|------|-------------|---------------|
| `starter` | 2 | 20 |
| `fully_subscribed` | 15 | 200 |
| BYOK (any tier) | 50 | 500 |

> **Note:** Monthly run cap enforcement guard (`false &&`) is currently disabled in the codebase. The limit is tracked in `icp_enrichment_runs` but not enforced.

---

## 3. Endpoint: `POST /functions/v1/personalise`

### Purpose

Generate a personalised B2B outreach message for a specific prospect, referencing a campaign asset (generation job). The copy is saved to `outreach_copies` and the prospect lifecycle is auto-advanced.

### Request

**Headers:**

| Header | Required | Value |
|--------|----------|-------|
| `Authorization` | ✅ | `Bearer <supabase_jwt>` |
| `Content-Type` | ✅ | `application/json` |

**Body (JSON):**

```typescript
{
  prospect_id: string     // UUID — must belong to caller's org
  job_id: string          // UUID — generation_jobs row, must belong to caller's org
  platform?: string       // default: "linkedin" | "email" | "twitter" | "cold_dm"
}
```

**Validation rules:**
- Body size > 1 MB → `413`
- `prospect_id` missing or not a string → `400 { error: "prospect_id required" }`
- `job_id` missing or not a string → `400 { error: "job_id required" }`

### Response — 200 OK

```typescript
{
  copy_text: string    // the personalised outreach message
  copy_id: string      // UUID of the saved outreach_copies row
}
```

### Response — Error Cases

| HTTP Status | `error` value | Cause |
|-------------|---------------|-------|
| 401 | `invalid_jwt` | Missing, expired, or invalid JWT |
| 413 | `payload_too_large` | Body > 1 MB |
| 400 | `prospect_id required` | `prospect_id` absent or wrong type |
| 400 | `job_id required` | `job_id` absent or wrong type |
| 404 | `prospect_not_found` | No prospect with that ID in this org |
| 404 | `job_not_found` | No generation job with that ID in this org |
| 404 | `brand_context_not_found` | Org has not saved brand context yet |
| 500 | `failed_to_save_copy` | `outreach_copies` insert failed |
| 401 | `auth_failed` | Provider API key auth error |
| 503 | `provider_unavailable` | AI provider returned retryable error |
| 502 | `provider_error` | AI provider returned non-retryable error |

### Side Effects

After generating copy:
1. `outreach_copies` row inserted with `status='draft'`
2. `prospects` row updated: `contacted_via='personal'`, `last_contacted_at=NOW()`
3. Prospect `status` advanced: `'new' → 'contacted'` **only** (no downgrade from `replied`, `qualified`, or `disqualified`)

### Prospect Lifecycle State Machine

```
new → contacted → replied → qualified
                          → disqualified
```

`personalise` only drives `new → contacted`. All other transitions are manual.

---

## 4. Endpoint: `POST /functions/v1/generate-campaign-brief`

### Purpose

Generate a full multi-channel campaign brief (posting schedule, per-channel copy, hashtag sets, timing recommendations) and a PDF attachment. The brief is saved to `campaign_briefs` and linked to a campaign.

### Request

**Headers:**

| Header | Required | Value |
|--------|----------|-------|
| `Authorization` | ✅ | `Bearer <supabase_jwt>` |
| `Content-Type` | ✅ | `application/json` |

**Body (JSON) — validated via Zod `GenerateCampaignBriefBodySchema`:**

```typescript
{
  campaign_id: string          // UUID — must belong to caller's org
  job_id?: string              // optional override for linked generation job
  channel_mix?: string[]       // default from campaign row: ["linkedin_message", "email"]
                               // valid values: "linkedin_post" | "linkedin_message" |
                               //               "email" | "twitter" | "twitter_x" |
                               //               "facebook_post" | "facebook" | "cold_dm"
  prospect_ids?: string[]      // optional override; defaults to campaign's prospects
}
```

**Validation rules:**
- Body size > 1 MB → `413`
- Zod schema failure → `400 { error: "validation_failed", details: <zod flatten> }`
- `campaign_id` must reference a row the org owns

### Response — 200 OK

```typescript
{
  brief_id: string             // UUID of the saved campaign_briefs row
  brief: BriefData             // structured brief (see §5)
  pdf_url?: string             // signed URL (1h expiry) to the PDF in Storage
}
```

### BriefData shape

```typescript
{
  executive_summary: string
  executive_summary_rationale?: string
  key_messages: string[]
  primary_cta: string
  posting_schedule: PostingDay[]
  content: {
    linkedin_post?: LinkedInPost[]
    linkedin_message?: DmVariant[]
    twitter?: TwitterPost[]
    facebook_post?: FacebookPost[]
    email?: EmailVariant[]
    cold_dm?: DmVariant[]
  }
  hashtag_sets: {
    branded?: string[]
    industry?: string[]
    general?: string[]
    regional?: string[]
    niche?: string[]
  }
  timing_recommendations: Record<string, TimingRec | string>
}
```

### PostingDay shape

```typescript
{
  day: number                  // 1-based day number in campaign
  recommended_date: string     // ISO 8601 date, e.g. "2025-05-12"
  phase: string                // "pre_launch" | "launch" | "sustain" | "recap" (varies by campaign_type)
  channel: string              // "linkedin_post" | "email" | ...
  post_type: string            // "teaser" | "announcement" | "use_case" | "social_proof" | ...
  theme: string                // short title for the day's content
  hook: string                 // opening line idea
  time_local: string           // "09:00"
  time_utc: string             // "09:00 UTC"
}
```

### Response — Error Cases

| HTTP Status | `error` value | Cause |
|-------------|---------------|-------|
| 401 | `invalid_jwt` | Missing, expired, or invalid JWT |
| 413 | `payload_too_large` | Body > 1 MB |
| 400 | `validation_failed` | Zod schema failure, includes `details` |
| 404 | `campaign_not_found` | No campaign with that ID in this org |
| 404 | `brand_context_not_found` | Org has no brand context row |
| 401 | `auth_failed` | Provider key auth error |
| 503 | `provider_unavailable` | AI provider retryable error |
| 502 | `provider_error` | AI provider non-retryable error |
| 500 | (generic) | Unexpected error |

---

## 5. Shared Models

### Prospect

```typescript
interface Prospect {
  id?: string                   // DB UUID (present after upsert)
  org_id?: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  linkedin_url?: string | null
  title?: string | null
  company_name?: string | null
  company_domain?: string | null
  company_description?: string | null
  company_size?: string | null  // "1-10" | "11-50" | "51-200" | "201-1000" | "1000+"
  industry?: string | null
  country?: string | null
  enrichment_source?: string | null  // "web_search" | "pdl" | "apollo" | ...
  enrichment_data?: object | null    // provider-specific metadata
  icp_score?: number | null          // 0.0–1.0 float (Math.round to 2 decimal places)
  status?: string                    // "new" | "contacted" | "replied" | "qualified" | "disqualified"
}
```

### ICPCriteria

```typescript
interface ICPCriteria {
  industries?: string[]
  company_sizes?: string[]     // valid: "1-10" | "11-50" | "51-200" | "201-1000" | "1000+"
  geographies?: string[]
  titles?: string[]
  keywords?: string[]
  domains?: string[]
}
```

---

## 6. ICP Score Algorithm

**Function:** `computeIcpScore(prospect: Prospect, criteria: ICPCriteria): number`

Returns a float in `[0, 1]` (rounded to 2 decimal places).

**Weights:**

| Criterion | Weight | Match rule |
|-----------|--------|------------|
| `industries` | 25% | Exact match (case-insensitive) — any element in `criteria.industries` |
| `titles` | 25% | Substring match (case-insensitive) — any element in `criteria.titles` |
| `company_sizes` | 20% | Exact string match — any element in `criteria.company_sizes` |
| `geographies` | 20% | Exact string match — any element in `criteria.geographies` |
| `keywords` | 10% | Substring match in `company_name + " " + company_description` |

**Algorithm:**

```
score = matched_weight / total_applicable_weight
```

Where `total_applicable_weight` is the sum of weights for criteria fields that are **set** (non-empty array). If no criteria are set, the score is 0.

**Example:**

If only `industries` and `titles` are set (total = 50) and both match (matched = 50):
```
score = 50 / 50 = 1.0
```

If only `industries` is set and matches:
```
score = 25 / 25 = 1.0
```

If all 5 are set and only `industry` matches:
```
score = 25 / 100 = 0.25
```

---

## 7. Prospect Enrichment Waterfall

The waterfall defines the order of enrichment providers tried:

```
1. PDL (People Data Labs)    — requires BYOK: PDL_API_KEY
2. Apollo.io                 — requires BYOK: APOLLO_API_KEY  
3. Hunter.io                 — requires BYOK: HUNTER_API_KEY
4. Clearbit                  — requires BYOK: CLEARBIT_API_KEY
5. web_scrape                — free, Puppeteer-based
6. web_search (Perplexity Sonar via OpenRouter) ← ONLY ACTIVE PROVIDER TODAY
```

> **Production status:** Steps 1–5 are implemented but commented out in `icp-enrich/index.ts`. Only `web_search` is active. This is by design for the initial launch; paid adapters will be unlocked when billing tiers enforce BYOK.

### web_search enrichment

- Provider: `perplexity/sonar-pro-search` via OpenRouter
- Hard cap: `MAX_RESULTS_HARD_CAP = 500` prospects per call
- Model behaviour: company-first enumeration → named decision-makers
- Every prospect must have: `source_url` (any verifiable URL) and/or `linkedin_url`
- Prospects with no verifiable URL are dropped silently
- Duplicate detection: deduplicated by `linkedin_url` → `source_url` → `name|company`

---

## 8. Security Controls

| Control | Detail |
|---------|--------|
| JWT auth | All 3 functions call `validateJWT(req)` + `extractOrgId(user)` before any DB operation |
| Org isolation | Every DB query includes `.eq('org_id', orgId)` — RLS policies provide defence-in-depth |
| Body size limit | All 3 functions enforce `Content-Length > 1MB → 413` |
| No `org_id` from body | `org_id` is always from `user.app_metadata.org_id` — never from request body or URL |
| No stack traces | All error responses return `{ error: 'description' }` only |
| CORS | Only `https://gtmengine.qubitlyventures.com` and `http://localhost:3000` — others get 403 |
| Untrusted content | Signal / prospect data treated as untrusted external content — never interpreted as instructions |
| Secret logging | API keys never logged — only provider key names are logged |
| PDF safety | `sanitisePdfText()` strips non-Latin1 characters to prevent `pdf-lib` crashes |
