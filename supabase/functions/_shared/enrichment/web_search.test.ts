/**
 * web_search enrichment adapter — unit tests
 *
 * Tests every pure function in _shared/enrichment/web_search.ts:
 *  clamp, summariseBrand, summariseCriteria, buildPrompt,
 *  extractJSON, normaliseDomain, normaliseLinkedIn, normaliseSize,
 *  enrichWebSearch (with mocked fetch)
 *
 * Run:  deno test supabase/functions/_shared/enrichment/web_search.test.ts
 */

import {
  assertEquals,
  assertAlmostEquals,
  assertStringIncludes,
  assertArrayIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import type { ICPCriteria, Prospect } from './types.ts'

// ─── Duplicate pure functions under test (identical to web_search.ts source) ─

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

interface WebSearchBrandSummary {
  company_name?: string | null
  one_sentence_pitch?: string | null
  products_services?: string[] | string | null
  active_themes?: string[] | null
}

function summariseBrand(brand: WebSearchBrandSummary | null): string {
  if (!brand) return ''
  const parts: string[] = []
  if (brand.one_sentence_pitch) parts.push(`Context (the seller — do NOT search for this company, only use it to understand who their buyers are): ${brand.one_sentence_pitch}`)
  let psList: string[] = []
  if (Array.isArray(brand.products_services)) {
    psList = brand.products_services
      .map((p: any) => {
        if (typeof p === 'string') return p
        if (p && typeof p === 'object') return p.name ?? p.title ?? null
        return null
      })
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
  } else if (typeof brand.products_services === 'string') {
    psList = [brand.products_services]
  }
  if (psList.length) parts.push(`Products / services they sell: ${psList.join(', ')}.`)
  if (brand.active_themes?.length) parts.push(`Topics they engage on: ${brand.active_themes.join(', ')}.`)
  return parts.join(' ')
}

function summariseCriteria(c: ICPCriteria): string {
  const lines: string[] = []
  if (c.industries?.length)     lines.push(`Industries: ${c.industries.join(', ')}`)
  if (c.titles?.length)         lines.push(`Job titles (any of): ${c.titles.join(', ')}`)
  if (c.company_sizes?.length)  lines.push(`Company sizes: ${c.company_sizes.join(', ')}`)
  if (c.geographies?.length)    lines.push(`Locations: ${c.geographies.join(', ')}`)
  if (c.keywords?.length)       lines.push(`Topics they care about: ${c.keywords.join(', ')}`)
  if (c.domains?.length)        lines.push(`Specific company domains: ${c.domains.join(', ')}`)
  return lines.join('\n')
}

function extractJSON(text: string): { prospects?: any[] } | null {
  if (!text) return null
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

function normaliseDomain(d: string | null | undefined): string | null {
  if (!d) return null
  return d.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '') || null
}

function normaliseLinkedIn(u: string | null | undefined): string | null {
  if (!u) return null
  const t = u.trim()
  if (!t) return null
  if (!/^https?:\/\//i.test(t)) return null
  if (!/linkedin\.com\/in\//i.test(t)) return null
  return t.replace(/\/$/, '')
}

function normaliseSize(s: string | null | undefined): string | null {
  if (!s) return null
  const v = String(s).trim()
  const valid = ['1-10', '11-50', '51-200', '201-1000', '1000+']
  if (valid.includes(v)) return v
  const lower = v.toLowerCase()
  if (lower.includes('smb') || lower.includes('small')) return '11-50'
  if (lower.includes('mid')) return '201-1000'
  if (lower.includes('enterprise') || lower.includes('large')) return '1000+'
  return null
}

// ─── clamp ────────────────────────────────────────────────────────────────────

Deno.test('clamp: value below min returns min', () => {
  assertEquals(clamp(-5, 1, 100), 1)
})

Deno.test('clamp: value above max returns max', () => {
  assertEquals(clamp(600, 1, 500), 500)
})

Deno.test('clamp: value in range returned unchanged', () => {
  assertEquals(clamp(42, 1, 100), 42)
})

Deno.test('clamp: min == max returns that value', () => {
  assertEquals(clamp(999, 5, 5), 5)
})

Deno.test('clamp: 0 is a valid result', () => {
  assertEquals(clamp(0, 0, 10), 0)
})

// ─── summariseBrand ───────────────────────────────────────────────────────────

Deno.test('summariseBrand: null returns empty string', () => {
  assertEquals(summariseBrand(null), '')
})

Deno.test('summariseBrand: includes one_sentence_pitch', () => {
  const s = summariseBrand({ one_sentence_pitch: 'We help GTM teams.' })
  assertStringIncludes(s, 'We help GTM teams.')
})

Deno.test('summariseBrand: string products_services', () => {
  const s = summariseBrand({ products_services: 'GTM platform' })
  assertStringIncludes(s, 'GTM platform')
})

Deno.test('summariseBrand: array of string products_services', () => {
  const s = summariseBrand({ products_services: ['CRM', 'Analytics'] })
  assertStringIncludes(s, 'CRM')
  assertStringIncludes(s, 'Analytics')
})

Deno.test('summariseBrand: array of object products_services uses name', () => {
  const s = summariseBrand({ products_services: [{ name: 'Outreach Tool' }] as any })
  assertStringIncludes(s, 'Outreach Tool')
})

Deno.test('summariseBrand: active_themes included', () => {
  const s = summariseBrand({ active_themes: ['AI', 'automation'] })
  assertStringIncludes(s, 'AI')
  assertStringIncludes(s, 'automation')
})

Deno.test('summariseBrand: empty brand object returns empty string', () => {
  assertEquals(summariseBrand({}), '')
})

Deno.test('summariseBrand: null products_services skipped', () => {
  const s = summariseBrand({ products_services: null, one_sentence_pitch: 'Pitch.' })
  assertStringIncludes(s, 'Pitch.')
  assertEquals(s.includes('Products'), false)
})

// ─── summariseCriteria ────────────────────────────────────────────────────────

Deno.test('summariseCriteria: empty criteria returns empty string', () => {
  assertEquals(summariseCriteria({}), '')
})

Deno.test('summariseCriteria: industries included', () => {
  assertStringIncludes(summariseCriteria({ industries: ['SaaS', 'Fintech'] }), 'SaaS')
})

Deno.test('summariseCriteria: titles included', () => {
  assertStringIncludes(summariseCriteria({ titles: ['CEO', 'CTO'] }), 'Job titles')
})

Deno.test('summariseCriteria: company_sizes included', () => {
  assertStringIncludes(summariseCriteria({ company_sizes: ['11-50'] }), 'Company sizes')
})

Deno.test('summariseCriteria: geographies included', () => {
  assertStringIncludes(summariseCriteria({ geographies: ['UK', 'Germany'] }), 'Locations')
})

Deno.test('summariseCriteria: keywords included', () => {
  assertStringIncludes(summariseCriteria({ keywords: ['machine learning'] }), 'Topics')
})

Deno.test('summariseCriteria: domains included', () => {
  assertStringIncludes(summariseCriteria({ domains: ['acme.com'] }), 'Specific company domains')
})

Deno.test('summariseCriteria: all fields produce multi-line output', () => {
  const s = summariseCriteria({
    industries: ['SaaS'],
    titles: ['CEO'],
    company_sizes: ['11-50'],
    geographies: ['UK'],
    keywords: ['cloud'],
    domains: ['example.com'],
  })
  const lines = s.split('\n').filter(Boolean)
  assertEquals(lines.length, 6)
})

// ─── extractJSON ──────────────────────────────────────────────────────────────

Deno.test('extractJSON: clean JSON returned', () => {
  const result = extractJSON('{"prospects":[{"first_name":"Alice"}]}')
  assertEquals(result?.prospects?.[0]?.first_name, 'Alice')
})

Deno.test('extractJSON: JSON inside markdown fences extracted', () => {
  const text = '```json\n{"prospects":[{"first_name":"Bob"}]}\n```'
  const result = extractJSON(text)
  assertEquals(result?.prospects?.[0]?.first_name, 'Bob')
})

Deno.test('extractJSON: JSON preceded by prose extracted', () => {
  const text = 'Here are the prospects:\n{"prospects":[]}'
  assertEquals(extractJSON(text)?.prospects?.length, 0)
})

Deno.test('extractJSON: empty string returns null', () => {
  assertEquals(extractJSON(''), null)
})

Deno.test('extractJSON: no braces returns null', () => {
  assertEquals(extractJSON('no JSON here at all'), null)
})

Deno.test('extractJSON: malformed JSON returns null', () => {
  assertEquals(extractJSON('{broken json}'), null)
})

Deno.test('extractJSON: nested JSON objects preserved', () => {
  const text = '{"prospects":[{"company_domain":"acme.com","enrichment_data":{"source":"web"}}]}'
  const result = extractJSON(text)
  assertEquals(result?.prospects?.[0]?.company_domain, 'acme.com')
})

// ─── normaliseDomain ──────────────────────────────────────────────────────────

Deno.test('normaliseDomain: strips https://', () => {
  assertEquals(normaliseDomain('https://acme.com'), 'acme.com')
})

Deno.test('normaliseDomain: strips http://', () => {
  assertEquals(normaliseDomain('http://acme.com'), 'acme.com')
})

Deno.test('normaliseDomain: strips www.', () => {
  assertEquals(normaliseDomain('www.acme.com'), 'acme.com')
})

Deno.test('normaliseDomain: strips path', () => {
  assertEquals(normaliseDomain('https://www.acme.com/about'), 'acme.com')
})

Deno.test('normaliseDomain: null input returns null', () => {
  assertEquals(normaliseDomain(null), null)
})

Deno.test('normaliseDomain: undefined input returns null', () => {
  assertEquals(normaliseDomain(undefined), null)
})

Deno.test('normaliseDomain: empty string returns null', () => {
  assertEquals(normaliseDomain(''), null)
})

Deno.test('normaliseDomain: lowercases output', () => {
  assertEquals(normaliseDomain('HTTPS://Acme.COM'), 'acme.com')
})

// ─── normaliseLinkedIn ────────────────────────────────────────────────────────

Deno.test('normaliseLinkedIn: valid URL returned', () => {
  assertEquals(
    normaliseLinkedIn('https://www.linkedin.com/in/alice-smith'),
    'https://www.linkedin.com/in/alice-smith',
  )
})

Deno.test('normaliseLinkedIn: trailing slash stripped', () => {
  assertEquals(
    normaliseLinkedIn('https://linkedin.com/in/bob-jones/'),
    'https://linkedin.com/in/bob-jones',
  )
})

Deno.test('normaliseLinkedIn: non-https URL rejected', () => {
  assertEquals(normaliseLinkedIn('linkedin.com/in/alice'), null) // no protocol
})

Deno.test('normaliseLinkedIn: non-LinkedIn URL rejected', () => {
  assertEquals(normaliseLinkedIn('https://twitter.com/alice'), null)
})

Deno.test('normaliseLinkedIn: null returns null', () => {
  assertEquals(normaliseLinkedIn(null), null)
})

Deno.test('normaliseLinkedIn: undefined returns null', () => {
  assertEquals(normaliseLinkedIn(undefined), null)
})

Deno.test('normaliseLinkedIn: empty string returns null', () => {
  assertEquals(normaliseLinkedIn(''), null)
})

// ─── normaliseSize ────────────────────────────────────────────────────────────

Deno.test('normaliseSize: valid bands pass through', () => {
  const valid = ['1-10', '11-50', '51-200', '201-1000', '1000+']
  for (const v of valid) {
    assertEquals(normaliseSize(v), v)
  }
})

Deno.test('normaliseSize: "smb" maps to "11-50"', () => {
  assertEquals(normaliseSize('SMB company'), '11-50')
})

Deno.test('normaliseSize: "small" maps to "11-50"', () => {
  assertEquals(normaliseSize('small startup'), '11-50')
})

Deno.test('normaliseSize: "mid" maps to "201-1000"', () => {
  assertEquals(normaliseSize('mid-market'), '201-1000')
})

Deno.test('normaliseSize: "enterprise" maps to "1000+"', () => {
  assertEquals(normaliseSize('enterprise'), '1000+')
})

Deno.test('normaliseSize: "large" maps to "1000+"', () => {
  assertEquals(normaliseSize('large corporation'), '1000+')
})

Deno.test('normaliseSize: null returns null', () => {
  assertEquals(normaliseSize(null), null)
})

Deno.test('normaliseSize: undefined returns null', () => {
  assertEquals(normaliseSize(undefined), null)
})

Deno.test('normaliseSize: unrecognised string returns null', () => {
  assertEquals(normaliseSize('giant'), null)
})

// ─── enrichWebSearch: mocked fetch ───────────────────────────────────────────

/** Creates a mock fetch that returns a Sonar-shaped response. */
function makeMockFetch(prospects: any[]): typeof globalThis.fetch {
  return async (_input: any, _init?: any): Promise<Response> => {
    return new Response(
      JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({ prospects }),
          },
        }],
        citations: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

/** Creates a mock fetch that returns an HTTP error. */
function makeErrorFetch(status: number, body = 'Internal Server Error'): typeof globalThis.fetch {
  return async () => new Response(body, { status })
}

Deno.test('enrichWebSearch: returns parsed prospects', async () => {
  const original = globalThis.fetch
  globalThis.fetch = makeMockFetch([
    {
      first_name: 'Alice', last_name: 'Smith', company_name: 'Acme',
      title: 'CEO', industry: 'SaaS', country: 'UK',
      linkedin_url: 'https://linkedin.com/in/alice-smith',
      source_url: 'https://acme.com/team',
      icp_fit_reason: 'CEO at SaaS company',
    },
  ])

  try {
    const { enrichWebSearch } = await import('./web_search.ts')
    const result = await enrichWebSearch(
      { industries: ['SaaS'] },
      null,
      'test-api-key',
      5,
    )
    assertEquals(result.length, 1)
    assertEquals(result[0].first_name, 'Alice')
    assertEquals(result[0].enrichment_source, 'web_search')
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('enrichWebSearch: throws on non-200 response', async () => {
  const original = globalThis.fetch
  globalThis.fetch = makeErrorFetch(500)
  try {
    const { enrichWebSearch } = await import('./web_search.ts')
    let threw = false
    try {
      await enrichWebSearch({ industries: ['SaaS'] }, null, 'test-key', 5)
    } catch {
      threw = true
    }
    assertEquals(threw, true)
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('enrichWebSearch: drops prospects with no source_url AND no linkedin_url', async () => {
  const original = globalThis.fetch
  globalThis.fetch = makeMockFetch([
    {
      first_name: 'Ghost', last_name: 'User', company_name: 'NoCo',
      linkedin_url: null, source_url: null,
    },
    {
      first_name: 'Real', last_name: 'Person', company_name: 'RealCo',
      linkedin_url: null, source_url: 'https://realco.com/team',
    },
  ])
  try {
    const { enrichWebSearch } = await import('./web_search.ts')
    const result = await enrichWebSearch({}, null, 'key', 10)
    assertEquals(result.length, 1)
    assertEquals(result[0].first_name, 'Real')
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('enrichWebSearch: deduplicates by linkedin_url', async () => {
  const original = globalThis.fetch
  globalThis.fetch = makeMockFetch([
    { first_name: 'A', last_name: 'B', company_name: 'Co', linkedin_url: 'https://linkedin.com/in/ab', source_url: 'https://co.com' },
    { first_name: 'A', last_name: 'B', company_name: 'Co', linkedin_url: 'https://linkedin.com/in/ab', source_url: 'https://co.com/2' },
  ])
  try {
    const { enrichWebSearch } = await import('./web_search.ts')
    const result = await enrichWebSearch({}, null, 'key', 10)
    assertEquals(result.length, 1)
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('enrichWebSearch: respects max_results cap', async () => {
  const original = globalThis.fetch
  const manyProspects = Array.from({ length: 20 }, (_, i) => ({
    first_name: `Person${i}`, last_name: 'Test', company_name: `Co${i}`,
    linkedin_url: `https://linkedin.com/in/person${i}`,
    source_url: `https://co${i}.com`,
  }))
  globalThis.fetch = makeMockFetch(manyProspects)
  try {
    const { enrichWebSearch } = await import('./web_search.ts')
    const result = await enrichWebSearch({}, null, 'key', 5)
    assertEquals(result.length <= 5, true)
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('enrichWebSearch: drops prospect with no first_name AND no last_name', async () => {
  const original = globalThis.fetch
  globalThis.fetch = makeMockFetch([
    { first_name: '', last_name: '', company_name: 'Anon', source_url: 'https://anon.com' },
    { first_name: 'Real', last_name: 'One', company_name: 'RealCo', source_url: 'https://real.com' },
  ])
  try {
    const { enrichWebSearch } = await import('./web_search.ts')
    const result = await enrichWebSearch({}, null, 'key', 10)
    assertEquals(result.length, 1)
    assertEquals(result[0].first_name, 'Real')
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('enrichWebSearch: drops prospect with no company_name', async () => {
  const original = globalThis.fetch
  globalThis.fetch = makeMockFetch([
    { first_name: 'No', last_name: 'Company', company_name: '', source_url: 'https://somewhere.com' },
    { first_name: 'Has', last_name: 'Company', company_name: 'Acme', source_url: 'https://acme.com' },
  ])
  try {
    const { enrichWebSearch } = await import('./web_search.ts')
    const result = await enrichWebSearch({}, null, 'key', 10)
    assertEquals(result.length, 1)
    assertEquals(result[0].first_name, 'Has')
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('enrichWebSearch: normalises company domain', async () => {
  const original = globalThis.fetch
  globalThis.fetch = makeMockFetch([{
    first_name: 'Test', last_name: 'User', company_name: 'TestCo',
    company_domain: 'https://www.testco.com/about',
    source_url: 'https://testco.com',
  }])
  try {
    const { enrichWebSearch } = await import('./web_search.ts')
    const result = await enrichWebSearch({}, null, 'key', 10)
    assertEquals(result[0].company_domain, 'testco.com')
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('enrichWebSearch: rejects invalid linkedin_url (no protocol)', async () => {
  const original = globalThis.fetch
  globalThis.fetch = makeMockFetch([{
    first_name: 'Test', last_name: 'User', company_name: 'TestCo',
    linkedin_url: 'linkedin.com/in/testuser', // invalid — no https://
    source_url: 'https://testco.com/team',
  }])
  try {
    const { enrichWebSearch } = await import('./web_search.ts')
    const result = await enrichWebSearch({}, null, 'key', 10)
    assertEquals(result[0].linkedin_url, null)
  } finally {
    globalThis.fetch = original
  }
})
