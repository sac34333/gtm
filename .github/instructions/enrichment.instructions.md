---
description: "Use when writing ICP enrichment adapters (PDL, Apollo, Hunter, Clearbit, web_scrape) or the icp-enrich Edge Function. Covers the waterfall pattern, icp_score algorithm, partial saves, and error handling."
applyTo: "supabase/functions/_shared/enrichment/**"
---

# Enrichment Adapter Guidelines

## Waterfall order (spec Section 11.3 — do NOT change the order)

```
PDL → Apollo → Hunter → Clearbit → web_scrape
```

- Each adapter is tried in order. If it returns data, **merge** the result into the prospect object — do not stop the waterfall. Later adapters fill fields that earlier ones missed.
- Continue to the next adapter if: (a) the current one throws, (b) returns empty/null for a field, or (c) the org has no key for that provider.
- `web_scrape` is always the final fallback — it requires no API key.

## Adapter interface — every adapter must implement this shape

```typescript
// _shared/enrichment/{provider}.ts
export interface EnrichmentResult {
  company_name?: string
  company_domain?: string
  company_size?: string        // e.g. '11-50', '51-200'
  industry?: string
  country?: string
  company_description?: string
  linkedin_url?: string
  email?: string
  title?: string
}

export async function enrich(
  prospect: { company_domain?: string; company_name?: string; email?: string },
  apiKey: string,
): Promise<EnrichmentResult>
```

## icp_score algorithm (spec Section 11.4 — exact weights)

```typescript
// Score 0–100. All five components must be calculated.
function calcIcpScore(prospect: Prospect, criteria: IcpCriteria): number {
  let score = 0
  // Industry match — 25 points
  if (criteria.industries?.includes(prospect.industry)) score += 25
  // Company size match — 25 points
  if (matchesSize(prospect.company_size, criteria.company_size_range)) score += 25
  // Country match — 20 points
  if (criteria.countries?.includes(prospect.country)) score += 20
  // Has LinkedIn URL — 20 points
  if (prospect.linkedin_url) score += 20
  // Has email — 10 points
  if (prospect.email) score += 10
  return score
}
```

## Partial save on failure

If one adapter throws, catch the error, log it, and continue. After the waterfall completes, **always** save whatever data was collected — even if only one field is populated. A partial prospect row is better than no row.

```typescript
try {
  const pdlResult = await pdl.enrich(prospect, pdlKey)
  merged = { ...merged, ...pdlResult }
} catch (err) {
  console.error('[icp-enrich] PDL failed:', err)
  // continue to next adapter
}
// ... same pattern for each adapter
// Always insert/upsert at the end
await supabase.from('prospects').upsert({ ...merged, icp_score: calcIcpScore(merged, criteria) })
```

## API key resolution

Resolve each provider's API key the same way as other adapters — from `org_api_keys` (decrypt with `_shared/encryption.ts`), falling back to platform env var:

| Provider | env var fallback |
|---|---|
| pdl | PDL_API_KEY |
| apollo | APOLLO_API_KEY |
| hunter | HUNTER_API_KEY |
| clearbit | CLEARBIT_API_KEY |

`web_scrape` never needs a key — use `fetch()` directly.

## web_scrape adapter — safety rules

- Always set a 10-second timeout on fetch: `AbortSignal.timeout(10_000)`
- Extract only: company description, social links. Do not parse sensitive data.
- If the domain is unreachable or returns non-200, return `{}` silently.

## Rate limiting awareness

- PDL: 1 req/s on free plan — add `await new Promise(r => setTimeout(r, 1000))` between bulk calls
- Apollo: respect 429 responses — return `{}` on rate limit (do not throw)
- Hunter: 25 req/month on free — log a warning if quota header indicates exhaustion
- Clearbit: 50 req/month on free — same pattern as Hunter
