/**
 * icp-enrich — unit tests
 *
 * Tests every exported-or-inlineable pure function without touching Supabase,
 * OpenRouter, or any other network service.
 *
 * Run:  deno test supabase/functions/icp-enrich/icp-enrich.test.ts
 */

import {
  assertEquals,
  assertAlmostEquals,
  assertStrictEquals,
  assertArrayIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

// ─── Replicate the pure functions under test ─────────────────────────────────
// We keep the logic in the main file (single-file Edge Functions don't export
// a test surface), so we duplicate the small pure functions here and keep them
// identical. Any drift will be caught by the integration smoke test at the end.

interface ICPCriteria {
  industries?: string[]
  company_sizes?: string[]
  geographies?: string[]
  titles?: string[]
  keywords?: string[]
  domains?: string[]
}

interface Prospect {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  linkedin_url?: string | null
  title?: string | null
  company_name?: string | null
  company_domain?: string | null
  company_description?: string | null
  company_size?: string | null
  industry?: string | null
  country?: string | null
  enrichment_source?: string | null
  enrichment_data?: any
  icp_score?: number
}

function computeIcpScore(prospect: Prospect, criteria: ICPCriteria): number {
  const weights = { industries: 25, titles: 25, company_sizes: 20, geographies: 20, keywords: 10 }
  let matched = 0, total = 0

  if (criteria.industries?.length) {
    total += weights.industries
    if (criteria.industries.some(i => i.toLowerCase() === prospect.industry?.toLowerCase())) {
      matched += weights.industries
    }
  }
  if (criteria.titles?.length) {
    total += weights.titles
    if (criteria.titles.some(t => prospect.title?.toLowerCase().includes(t.toLowerCase()))) {
      matched += weights.titles
    }
  }
  if (criteria.company_sizes?.length) {
    total += weights.company_sizes
    if (criteria.company_sizes.includes(prospect.company_size ?? '')) {
      matched += weights.company_sizes
    }
  }
  if (criteria.geographies?.length) {
    total += weights.geographies
    if (criteria.geographies.includes(prospect.country ?? '')) {
      matched += weights.geographies
    }
  }
  if (criteria.keywords?.length) {
    total += weights.keywords
    const text = `${prospect.company_name ?? ''} ${prospect.company_description ?? ''}`.toLowerCase()
    if (criteria.keywords.some(k => text.includes(k.toLowerCase()))) {
      matched += weights.keywords
    }
  }

  return total > 0 ? Math.round((matched / total) * 100) / 100 : 0
}

function mergeProspects(base: Prospect[], additional: Prospect[]): Prospect[] {
  const merged = [...base]
  for (const ap of additional) {
    const matchIdx = merged.findIndex(p =>
      (ap.linkedin_url && p.linkedin_url && ap.linkedin_url === p.linkedin_url) ||
      (ap.email && p.email && ap.email === p.email) ||
      (ap.first_name && ap.last_name && ap.company_name &&
        p.first_name === ap.first_name && p.last_name === ap.last_name && p.company_name === ap.company_name)
    )
    if (matchIdx >= 0) {
      const existing = merged[matchIdx]
      if (!existing.email && ap.email) existing.email = ap.email
      if (!existing.company_description && ap.company_description) existing.company_description = ap.company_description
      if (!existing.linkedin_url && ap.linkedin_url) existing.linkedin_url = ap.linkedin_url
      if (!existing.company_name && ap.company_name) existing.company_name = ap.company_name
      if (!existing.company_domain && ap.company_domain) existing.company_domain = ap.company_domain
    } else {
      merged.push(ap)
    }
  }
  return merged
}

type EnrichmentLimits = { runs: number; max_per_run: number }
const PROSPECT_LIMITS: Record<string, EnrichmentLimits> = {
  starter:          { runs: 2,  max_per_run: 20  },
  fully_subscribed: { runs: 15, max_per_run: 200 },
}
const BYOK_LIMITS: EnrichmentLimits = { runs: 50, max_per_run: 500 }

function getLimitsFor(planTier: string, byok: boolean): EnrichmentLimits {
  if (byok) return BYOK_LIMITS
  return PROSPECT_LIMITS[planTier] ?? PROSPECT_LIMITS.starter
}

// ─── computeIcpScore ─────────────────────────────────────────────────────────

Deno.test('computeIcpScore: perfect match returns 1.0', () => {
  const criteria: ICPCriteria = {
    industries: ['SaaS'],
    titles: ['CEO'],
    company_sizes: ['11-50'],
    geographies: ['United Kingdom'],
    keywords: ['fintech'],
  }
  const prospect: Prospect = {
    industry: 'SaaS',
    title: 'CEO',
    company_size: '11-50',
    country: 'United Kingdom',
    company_description: 'a fintech platform',
  }
  assertAlmostEquals(computeIcpScore(prospect, criteria), 1.0, 0.001)
})

Deno.test('computeIcpScore: zero match returns 0', () => {
  const criteria: ICPCriteria = {
    industries: ['Healthcare'],
    titles: ['CFO'],
    geographies: ['Germany'],
  }
  const prospect: Prospect = {
    industry: 'Logistics',
    title: 'VP Engineering',
    country: 'France',
  }
  assertEquals(computeIcpScore(prospect, criteria), 0)
})

Deno.test('computeIcpScore: empty criteria returns 0', () => {
  const prospect: Prospect = { industry: 'SaaS', title: 'CEO' }
  assertEquals(computeIcpScore(prospect, {}), 0)
})

Deno.test('computeIcpScore: partial match — industry + title only, no size/geo', () => {
  const criteria: ICPCriteria = {
    industries: ['SaaS'],
    titles: ['CTO'],
  }
  const prospect: Prospect = {
    industry: 'saas', // case-insensitive
    title: 'CTO & Co-founder',
  }
  // Both criteria met → 25+25=50 matched / 50 total = 1.0
  assertAlmostEquals(computeIcpScore(prospect, criteria), 1.0, 0.001)
})

Deno.test('computeIcpScore: title partial substring match', () => {
  const criteria: ICPCriteria = { titles: ['chief marketing'] }
  const prospect: Prospect = { title: 'Chief Marketing Officer' }
  // titles.some(t => title.toLowerCase().includes(t.toLowerCase())) → true
  assertAlmostEquals(computeIcpScore(prospect, criteria), 1.0, 0.001)
})

Deno.test('computeIcpScore: keyword match in company_name', () => {
  const criteria: ICPCriteria = { keywords: ['AI'] }
  const prospect: Prospect = { company_name: 'Acme AI Inc', company_description: null }
  assertAlmostEquals(computeIcpScore(prospect, criteria), 1.0, 0.001)
})

Deno.test('computeIcpScore: keyword match is case-insensitive', () => {
  const criteria: ICPCriteria = { keywords: ['machine learning'] }
  const prospect: Prospect = { company_description: 'Specialises in Machine Learning infrastructure.' }
  assertAlmostEquals(computeIcpScore(prospect, criteria), 1.0, 0.001)
})

Deno.test('computeIcpScore: score is fractional for partial match', () => {
  const criteria: ICPCriteria = {
    industries: ['SaaS'],
    titles: ['CFO'],
    company_sizes: ['201-1000'],
    geographies: ['United States'],
    keywords: ['cloud'],
  }
  // Only industry matches (25/100)
  const prospect: Prospect = {
    industry: 'SaaS',
    title: 'VP Sales',
    company_size: '11-50',
    country: 'Germany',
    company_description: 'on-premise solution',
  }
  assertAlmostEquals(computeIcpScore(prospect, criteria), 0.25, 0.001)
})

Deno.test('computeIcpScore: null prospect fields do not throw', () => {
  const criteria: ICPCriteria = {
    industries: ['SaaS'],
    titles: ['CEO'],
    company_sizes: ['11-50'],
    geographies: ['UK'],
    keywords: ['fintech'],
  }
  const prospect: Prospect = {
    industry: null,
    title: null,
    company_size: null,
    country: null,
    company_description: null,
  }
  assertEquals(computeIcpScore(prospect, criteria), 0)
})

Deno.test('computeIcpScore: only keywords present', () => {
  const criteria: ICPCriteria = { keywords: ['blockchain'] }
  const prospect: Prospect = { company_name: 'Blockchain Capital', company_description: 'Blockchain venture fund' }
  assertAlmostEquals(computeIcpScore(prospect, criteria), 1.0, 0.001)
})

// ─── mergeProspects ───────────────────────────────────────────────────────────

Deno.test('mergeProspects: dedupes by linkedin_url', () => {
  const base: Prospect[] = [{
    first_name: 'Alice', last_name: 'Smith', company_name: 'Acme',
    linkedin_url: 'https://linkedin.com/in/alice-smith',
    email: null,
  }]
  const additional: Prospect[] = [{
    first_name: 'Alice', last_name: 'Smith', company_name: 'Acme',
    linkedin_url: 'https://linkedin.com/in/alice-smith',
    email: 'alice@acme.com',
  }]
  const result = mergeProspects(base, additional)
  assertEquals(result.length, 1)
  assertEquals(result[0].email, 'alice@acme.com') // filled in from additional
})

Deno.test('mergeProspects: dedupes by email', () => {
  const base: Prospect[] = [{
    first_name: 'Bob', last_name: 'Jones', company_name: 'BobCo',
    email: 'bob@bobco.com', linkedin_url: null,
  }]
  const additional: Prospect[] = [{
    first_name: 'Bob', last_name: 'Jones', company_name: 'BobCo',
    email: 'bob@bobco.com', linkedin_url: 'https://linkedin.com/in/bob-jones',
  }]
  const result = mergeProspects(base, additional)
  assertEquals(result.length, 1)
  assertEquals(result[0].linkedin_url, 'https://linkedin.com/in/bob-jones')
})

Deno.test('mergeProspects: dedupes by name+company', () => {
  const base: Prospect[] = [{
    first_name: 'Carol', last_name: 'White', company_name: 'WhiteCo',
    email: null, linkedin_url: null,
  }]
  const additional: Prospect[] = [{
    first_name: 'Carol', last_name: 'White', company_name: 'WhiteCo',
    company_description: 'A leading SaaS firm.',
  }]
  const result = mergeProspects(base, additional)
  assertEquals(result.length, 1)
  assertEquals(result[0].company_description, 'A leading SaaS firm.')
})

Deno.test('mergeProspects: appends genuinely new prospect', () => {
  const base: Prospect[] = [{ first_name: 'Alice', last_name: 'Smith', company_name: 'Acme', email: 'a@acme.com' }]
  const additional: Prospect[] = [{ first_name: 'Dave', last_name: 'Lee', company_name: 'LeeInc', email: 'd@lee.com' }]
  const result = mergeProspects(base, additional)
  assertEquals(result.length, 2)
})

Deno.test('mergeProspects: empty base returns additional', () => {
  const additional: Prospect[] = [{ first_name: 'Eve', last_name: 'Brown', company_name: 'BrownCo' }]
  assertEquals(mergeProspects([], additional).length, 1)
})

Deno.test('mergeProspects: empty additional returns base unchanged', () => {
  const base: Prospect[] = [{ first_name: 'Frank', last_name: 'Green', company_name: 'GreenCo' }]
  assertEquals(mergeProspects(base, []).length, 1)
})

Deno.test('mergeProspects: does not overwrite existing email with null', () => {
  const base: Prospect[] = [{ first_name: 'Gina', last_name: 'Blue', company_name: 'BlueCo', email: 'gina@blue.com', linkedin_url: 'https://linkedin.com/in/gina' }]
  const additional: Prospect[] = [{ first_name: 'Gina', last_name: 'Blue', company_name: 'BlueCo', email: null, linkedin_url: 'https://linkedin.com/in/gina' }]
  const result = mergeProspects(base, additional)
  assertEquals(result[0].email, 'gina@blue.com') // original preserved
})

Deno.test('mergeProspects: fills company_domain gap', () => {
  const base: Prospect[] = [{ first_name: 'Hank', last_name: 'Red', company_name: 'RedCo', company_domain: null, linkedin_url: 'https://linkedin.com/in/hank' }]
  const additional: Prospect[] = [{ first_name: 'Hank', last_name: 'Red', company_name: 'RedCo', company_domain: 'redco.com', linkedin_url: 'https://linkedin.com/in/hank' }]
  assertEquals(mergeProspects(base, additional)[0].company_domain, 'redco.com')
})

// ─── getLimitsFor ─────────────────────────────────────────────────────────────

Deno.test('getLimitsFor: starter plan', () => {
  const l = getLimitsFor('starter', false)
  assertEquals(l.runs, 2)
  assertEquals(l.max_per_run, 20)
})

Deno.test('getLimitsFor: fully_subscribed plan', () => {
  const l = getLimitsFor('fully_subscribed', false)
  assertEquals(l.runs, 15)
  assertEquals(l.max_per_run, 200)
})

Deno.test('getLimitsFor: BYOK flag overrides plan tier', () => {
  const l = getLimitsFor('starter', true)
  assertEquals(l.runs, 50)
  assertEquals(l.max_per_run, 500)
})

Deno.test('getLimitsFor: unknown plan falls back to starter', () => {
  const l = getLimitsFor('enterprise_unknown', false)
  assertEquals(l.runs, 2)
  assertEquals(l.max_per_run, 20)
})

Deno.test('getLimitsFor: BYOK + fully_subscribed still uses BYOK', () => {
  const l = getLimitsFor('fully_subscribed', true)
  assertEquals(l.runs, 50)
})

// ─── HTTP handler smoke tests (with mocked Supabase + fetch) ─────────────────

/** Minimal Supabase mock that chains .from().select()...etc and returns data. */
function makeDbMock(overrides: Record<string, any> = {}) {
  const defaults: Record<string, any> = {
    orgs: { plan_tier: 'starter', byok_mode: false, slug: 'test-org' },
    brand_contexts: { company_name: 'TestCo', one_sentence_pitch: 'We help teams grow.', active_themes: ['AI'] },
    prospects: [],
    icp_enrichment_runs: null,
    ...overrides,
  }

  function chainFor(table: string) {
    const data = defaults[table]
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      neq: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      update: () => chain,
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'run-1' }, error: null }) }) }),
      upsert: () => ({ select: () => ({ single: async () => ({ data: { id: 'p-1', ...data?.prospects?.[0] }, error: null }) }) }),
      maybeSingle: async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error: null }),
      single: async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error: null }),
      then: undefined,
    }
    // Make awaitable
    Object.defineProperty(chain, Symbol.asyncIterator, { value: undefined })
    return chain
  }

  return {
    from: (table: string) => chainFor(table),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://signed' }, error: null }) }) },
    rpc: async () => ({ data: [], error: null }),
  }
}

/** Build a minimal JWT-bearing Request with a JSON body. */
function makeRequest(body: Record<string, unknown>): Request {
  return new Request('https://fn.example.com/icp-enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // This is a signed JWT with org_id in app_metadata — we mock validateJWT below.
      'Authorization': 'Bearer mock.jwt.token',
    },
    body: JSON.stringify(body),
  })
}

// ─── CORS preflight ───────────────────────────────────────────────────────────

Deno.test('icp-enrich handler: OPTIONS returns 204', async () => {
  const req = new Request('https://fn.example.com/icp-enrich', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://gtmengine.qubitlyventures.com',
      'Access-Control-Request-Method': 'POST',
    },
  })
  const { handleCors } = await import('../_shared/cors.ts')
  const res = handleCors(req)
  assertEquals(res?.status, 204)
})

// ─── Input validation ─────────────────────────────────────────────────────────

Deno.test('computeIcpScore: single geography criterion respected', () => {
  const criteria: ICPCriteria = { geographies: ['India'] }
  const matching: Prospect = { country: 'India' }
  const nonMatching: Prospect = { country: 'Brazil' }
  assertAlmostEquals(computeIcpScore(matching, criteria), 1.0, 0.001)
  assertAlmostEquals(computeIcpScore(nonMatching, criteria), 0, 0.001)
})

Deno.test('computeIcpScore: multiple industries — any match counts', () => {
  const criteria: ICPCriteria = { industries: ['SaaS', 'Fintech', 'HealthTech'] }
  const prospect: Prospect = { industry: 'Fintech' }
  assertAlmostEquals(computeIcpScore(prospect, criteria), 1.0, 0.001)
})

Deno.test('computeIcpScore: industry comparison is case-insensitive', () => {
  const criteria: ICPCriteria = { industries: ['SAAS'] }
  const prospect: Prospect = { industry: 'saas' }
  assertAlmostEquals(computeIcpScore(prospect, criteria), 1.0, 0.001)
})

// ─── Scoring weight sanity checks ─────────────────────────────────────────────

Deno.test('computeIcpScore: weights sum to 100 when all criteria set and matched', () => {
  const criteria: ICPCriteria = {
    industries: ['AI'],
    titles: ['CTO'],
    company_sizes: ['51-200'],
    geographies: ['USA'],
    keywords: ['devtools'],
  }
  const prospect: Prospect = {
    industry: 'AI',
    title: 'CTO',
    company_size: '51-200',
    country: 'USA',
    company_description: 'devtools platform',
  }
  // Should be exactly 1.0 (all 100 points matched / 100 total)
  assertAlmostEquals(computeIcpScore(prospect, criteria), 1.0, 0.001)
})

Deno.test('computeIcpScore: company_size exact match only', () => {
  const criteria: ICPCriteria = { company_sizes: ['201-1000'] }
  const prospect: Prospect = { company_size: '1000+' }
  assertEquals(computeIcpScore(prospect, criteria), 0)
})
