// Web-search–powered prospect discovery using Perplexity Sonar via OpenRouter.
//
// Why: gives a free / very cheap fallback when an org has no paid enrichment
// provider keys (Apollo / PDL / Hunter / Clearbit). Sonar grounds its answers
// in live public web search (LinkedIn public profiles, Crunchbase, news),
// so we can return real named prospects with a "why this matches" reason
// suitable for a demo or low-volume production use.
//
// Cost guard: ~$0.01–$0.05 per call. Caller MUST cap max_results.

import type { ICPCriteria, Prospect } from './types.ts'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
// sonar-pro-search adds autonomous multi-step research workflows on top of sonar-pro.
// It plans and executes multi-query research instead of one query+synthesis, which
// is exactly what enumerating prospects ("find 20 CMOs at SaaS in UK") needs.
// Pricing: $3/M input, $15/M output, +$18/1k requests for Pro Search mode.
const DEFAULT_MODEL = 'perplexity/sonar-pro-search'

// Hard ceiling — never request more than this from Sonar in a single call,
// regardless of what the caller passes. Protects against runaway cost.
// Tier-based caller limits are enforced upstream in icp-enrich.
const MAX_RESULTS_HARD_CAP = 500

export interface WebSearchBrandSummary {
  company_name?: string | null
  one_sentence_pitch?: string | null
  products_services?: string[] | string | null
  active_themes?: string[] | null
}

interface SonarMessage {
  role: 'system' | 'user'
  content: string
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function summariseBrand(brand: WebSearchBrandSummary | null): string {
  if (!brand) return ''
  const parts: string[] = []
  if (brand.one_sentence_pitch) parts.push(`Context (the seller — do NOT search for this company, only use it to understand who their buyers are): ${brand.one_sentence_pitch}`)
  // products_services may be: string, string[], or array of { name, description } objects.
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

function buildPrompt(
  criteria: ICPCriteria,
  brand: WebSearchBrandSummary | null,
  maxResults: number,
): SonarMessage[] {
  const brandLine = summariseBrand(brand)
  const criteriaBlock = summariseCriteria(criteria)

  const system = `You are a B2B prospect researcher. Your ONLY tool is live web search. Your job is to enumerate real, currently-employed senior decision-makers at companies that match a buyer profile (ICP).

NON-NEGOTIABLE RULES:
- NEVER invent names, titles, companies, or URLs. Every person you return must come from a real search result you actually saw.
- Every prospect MUST have at least one verifiable URL (LinkedIn profile, company team / about page, Crunchbase, or news article that names them in their current role).
- Do NOT return email addresses (the caller does not want them).
- Aim for COMPLETE lists, not 1-2 examples.
- IMPORTANT: LinkedIn often blocks scraping. If you cannot find a LinkedIn URL for someone, that is FINE — still include them and put the source URL (Crunchbase, company about page, news article, etc.) in source_url instead. DO NOT drop people just because LinkedIn is unavailable.`

  const criteriaCountries = (criteria.geographies ?? []).filter(Boolean)
  const perCountryTarget = criteriaCountries.length > 0
    ? Math.max(2, Math.ceil(maxResults / criteriaCountries.length))
    : maxResults

  const titleList = (criteria.titles ?? []).filter(Boolean)
  const industryList = (criteria.industries ?? []).filter(Boolean)

  const user = `[SELLER CONTEXT — do not search for this seller; use only to understand the buyer]
${brandLine || '(no seller context)'}

[ICP CRITERIA — the people you return must match these]
${criteriaBlock}

[YOUR TASK — COMPANY-FIRST ENUMERATION]
You must produce ${maxResults} verified prospects. Direct LinkedIn searches usually fail (LinkedIn blocks bots). Use this two-step approach:

STEP 1 — Find COMPANIES first (this is where most signal lives):
Queries that work well:${industryList.length && criteriaCountries.length ? `
  "top ${industryList[0]} companies in ${criteriaCountries[0]}" 2025
  "${industryList[0]} startups" "${criteriaCountries[0]}" Crunchbase
  site:tracxn.com "${industryList[0]}" "${criteriaCountries[0]}"
  site:inc42.com OR site:yourstory.com "${industryList[0]}"  (for India)
  "raised funding" "${industryList[0]}" "${criteriaCountries[0]}" 2024 OR 2025` : `
  "top <industry> companies in <country>"
  Crunchbase / Tracxn lists for the industry + country
  Recent funding announcements`}

STEP 2 — For each company found, identify the named decision-maker:
- Visit the company's About / Team / Leadership page — names and titles are public.
- Read recent news / press releases — founders and CEOs are quoted by name.
- Check Crunchbase / Tracxn company pages — they list the founder + leadership.
- Optionally try to find LinkedIn URL via Google search of "<Name> <Company> linkedin" — if it works, include it; if not, use the company team page URL or the news article URL as source_url.

REQUIRED SEARCH PLAN${criteriaCountries.length > 0 ? `:
- For each of the ${criteriaCountries.length} countries (${criteriaCountries.join(', ')}), find ${perCountryTarget} target companies, then identify their ${titleList.slice(0, 3).join(' / ') || 'CEO/Founder'}.
- Run AT LEAST ${Math.max(criteriaCountries.length * 2, 4)} distinct searches.` : `:
- Run multiple searches across the listed industries and titles to enumerate ${maxResults} distinct prospects.`}

[OUTPUT — STRICT JSON, NO PROSE, NO MARKDOWN FENCES, NO EXPLANATION TEXT]
Shape: { "prospects": [ {...}, {...} ] }
Each prospect object MUST have these keys:
{
  "first_name": string,
  "last_name": string,
  "title": string,                 // current job title
  "company_name": string,
  "company_domain": string|null,   // root domain only, no protocol, no path
  "company_description": string|null, // 1 short sentence
  "company_size": string|null,     // "1-10" | "11-50" | "51-200" | "201-1000" | "1000+"
  "industry": string|null,
  "country": string|null,
  "location": string|null,         // City, Country
  "linkedin_url": string|null,     // https://www.linkedin.com/in/<slug> if you found it; null otherwise
  "source_url": string,            // REQUIRED. Any URL where you verified this person (company about page, Crunchbase, news article, LinkedIn). Used to prove they exist.
  "icp_fit_reason": string         // 1 sentence: why this person fits the ICP
}

HARD RULES:
- Target: ${maxResults} prospects. Minimum acceptable: ${Math.min(maxResults, 8)}.
- EVERY prospect must have a source_url (any verifiable URL). LinkedIn URL is optional.
- Do NOT return more than 2 people from the same company.
- Do NOT include email addresses.
- Returning 0 prospects is a FAILURE. If specific industry/title combinations don't yield results, broaden them (e.g. "AI / SaaS / IT services" → "tech startups"; "Chief Digital Officer" → "CTO / VP Engineering") rather than giving up.`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
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
  // Map common variants
  const lower = v.toLowerCase()
  if (lower.includes('smb') || lower.includes('small')) return '11-50'
  if (lower.includes('mid')) return '201-1000'
  if (lower.includes('enterprise') || lower.includes('large')) return '1000+'
  return null
}

export async function enrichWebSearch(
  criteria: ICPCriteria,
  brand: WebSearchBrandSummary | null,
  openrouterApiKey: string,
  maxResults = 20,
  orgSlug?: string,
  modelId: string = DEFAULT_MODEL,
): Promise<Prospect[]> {
  const cap = clamp(maxResults, 1, MAX_RESULTS_HARD_CAP)
  const messages = buildPrompt(criteria, brand, cap)

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${openrouterApiKey}`,
    'Content-Type': 'application/json',
  }
  if (orgSlug) {
    // Headers must be ASCII-only (ByteString). Strip anything non-ASCII from slug to be safe.
    const safeSlug = orgSlug.replace(/[^\x20-\x7E]/g, '')
    headers['HTTP-Referer'] = `https://gtmengine.qubitlyventures.com/${safeSlug}`
    headers['X-Title'] = 'GTM Engine - ICP Discovery'
  }

  // Native search models (Perplexity Sonar, OpenAI gpt-*-search, etc.) are always-on.
  // For other models, automatically append :online to enable web search via Exa.
  const needsOnlineSuffix = !modelId.includes(':online')
    && !modelId.startsWith('perplexity/')
    && !/-search/i.test(modelId)
  const effectiveModel = needsOnlineSuffix ? `${modelId}:online` : modelId

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: effectiveModel,
      messages,
      temperature: 0.2,
      // ~300 tokens/prospect × 25 + buffer for reasoning/JSON overhead.
      max_tokens: 12000,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`sonar ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  const citations: string[] = Array.isArray(data?.citations) ? data.citations : []
  const parsed = extractJSON(content)
  const arr = Array.isArray(parsed?.prospects) ? parsed!.prospects! : []

  // Debug: when Sonar returns 0 prospects, log the raw response so we can see
  // whether the model refused, hallucinated wrong shape, or genuinely found nothing.
  // No PII concern — this is the model's research output, not user credentials.
  if (arr.length === 0) {
    console.warn('[web_search] Sonar returned 0 prospects.', {
      model: effectiveModel,
      content_preview: content.slice(0, 500),
      citations_count: citations.length,
      first_citations: citations.slice(0, 5),
    })
  }

  const out: Prospect[] = []
  const seenLinkedIn = new Set<string>()
  const seenName = new Set<string>()
  const seenSource = new Set<string>()

  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue
    const first = String(raw.first_name ?? '').trim()
    const last = String(raw.last_name ?? '').trim()
    if (!first && !last) continue
    const company = String(raw.company_name ?? '').trim()
    if (!company) continue

    const li = normaliseLinkedIn(raw.linkedin_url)
    const sourceUrl = typeof raw.source_url === 'string' && /^https?:\/\//i.test(raw.source_url.trim())
      ? raw.source_url.trim()
      : null

    // Require AT LEAST one verifiable URL (LinkedIn or source). Drop pure hallucinations.
    if (!li && !sourceUrl) continue
    if (li && seenLinkedIn.has(li)) continue
    if (!li && sourceUrl && seenSource.has(sourceUrl)) continue
    const nameKey = `${first}|${last}|${company}`.toLowerCase()
    if (seenName.has(nameKey)) continue
    if (li) seenLinkedIn.add(li)
    if (sourceUrl) seenSource.add(sourceUrl)
    seenName.add(nameKey)

    const fit = typeof raw.icp_fit_reason === 'string' ? raw.icp_fit_reason.trim() : ''
    out.push({
      first_name: first || null,
      last_name: last || null,
      email: null,
      linkedin_url: li,
      title: typeof raw.title === 'string' ? raw.title.trim() : null,
      company_name: company,
      company_domain: normaliseDomain(raw.company_domain),
      company_description: typeof raw.company_description === 'string' ? raw.company_description.trim() : null,
      company_size: normaliseSize(raw.company_size),
      industry: typeof raw.industry === 'string' ? raw.industry.trim() : null,
      country: typeof raw.country === 'string' ? raw.country.trim() : null,
      enrichment_source: 'web_search',
      enrichment_data: {
        location: typeof raw.location === 'string' ? raw.location.trim() : null,
        icp_fit_reason: fit || null,
        source_url: sourceUrl,
        model: effectiveModel,
      },
    })

    if (out.length >= cap) break
  }

  return out
}
