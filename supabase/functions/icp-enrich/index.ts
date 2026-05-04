import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { enrichPDL } from '../_shared/enrichment/pdl.ts'
import { enrichApollo } from '../_shared/enrichment/apollo.ts'
import { enrichHunter } from '../_shared/enrichment/hunter.ts'
import { enrichClearbit } from '../_shared/enrichment/clearbit.ts'
import { scrapePublicProfile } from '../_shared/enrichment/web_scrape.ts'
import { enrichWebSearch } from '../_shared/enrichment/web_search.ts'
import { resolveApiKey, ProviderError, userMessageFor } from '../_shared/providers/router.ts'
import type { ICPCriteria, Prospect } from '../_shared/enrichment/types.ts'

// Hard caps to prevent runaway cost / abuse on the LLM-web-search path.
// Runs are always counted per calendar 30-day window across all tiers.
// max_per_run is the upper bound for a single enrichment call.
const WEB_SEARCH_DEFAULT_RESULTS = 20

type EnrichmentLimits = { runs: number; max_per_run: number }

const PROSPECT_LIMITS: Record<string, EnrichmentLimits> = {
  starter:          { runs: 2,  max_per_run: 20  },  // free trial — 40 prospects / month total
  fully_subscribed: { runs: 15, max_per_run: 200 },  // paid — 3,000 prospects / month total
}
// BYOK orgs pay OpenRouter directly — higher ceiling since cost isn't on us.
const BYOK_LIMITS: EnrichmentLimits = { runs: 50, max_per_run: 500 } // 25,000 / month

function getLimitsFor(planTier: string, byok: boolean): EnrichmentLimits {
  if (byok) return BYOK_LIMITS
  return PROSPECT_LIMITS[planTier] ?? PROSPECT_LIMITS.starter
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
      // Fill gaps
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

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    // Parse and validate body
    const body = await req.json()
    const rescore_only: boolean = body.rescore_only ?? false
    // Support both flat and nested { criteria: {...} } shapes
    const raw = body.criteria ?? body
    const {
      industries = [],
      company_sizes = [],
      geographies = [],
      titles = [],
      keywords = [],
      domains = [],
    } = raw as ICPCriteria

    // Validate body size / content
    const allArrays = [industries, company_sizes, geographies, titles, keywords, domains]
    for (const arr of allArrays) {
      if (!Array.isArray(arr)) {
        return new Response(JSON.stringify({ error: 'invalid_input' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const criteria: ICPCriteria = { industries, company_sizes, geographies, titles, keywords, domains }

    // Save criteria + load brand context for the search prompt
    const { data: brand } = await db.from('brand_contexts')
      .select('company_name, one_sentence_pitch, products_services, active_themes')
      .eq('org_id', orgId)
      .maybeSingle()

    await db.from('brand_contexts')
      .update({ last_icp_criteria: criteria })
      .eq('org_id', orgId)

    // rescore_only: skip waterfall, recompute scores on existing prospects
    if (rescore_only) {
      const { data: existingProspects } = await db
        .from('prospects')
        .select('*')
        .eq('org_id', orgId)

      if (existingProspects?.length) {
        for (const p of existingProspects) {
          const score = computeIcpScore(p as Prospect, criteria)
          await db.from('prospects')
            .update({ icp_score: score })
            .eq('id', p.id)
        }
      }

      return new Response(
        JSON.stringify({ prospects: existingProspects ?? [], total: existingProspects?.length ?? 0, enrichment_sources_used: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // === USAGE CAPS (only for net-new enrichment runs, not rescore) ===
    // Resolve tiered limits based on org plan + BYOK mode.
    const { data: orgPlan } = await db
      .from('orgs')
      .select('plan_tier, byok_mode')
      .eq('id', orgId)
      .single()
    const planTier = (orgPlan as any)?.plan_tier ?? 'starter'
    const byok = Boolean((orgPlan as any)?.byok_mode)
    const limits = getLimitsFor(planTier, byok)

    // Per-run cap on web-search results (caller may pass max_results, server clamps to tier's max_per_run).
    const requestedMax = Number(body.max_results) || WEB_SEARCH_DEFAULT_RESULTS
    // TEMP (testing): ignore tier max_per_run; only enforce adapter hard cap (500).
    const webSearchMax = Math.max(1, Math.min(requestedMax, 500))

    // Run cap — distinct web_search runs in the last 30 days, across all tiers.
    const runsCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentRuns } = await db
      .from('prospects')
      .select('created_at')
      .eq('org_id', orgId)
      .eq('enrichment_source', 'web_search')
      .gte('created_at', runsCutoff)
      .order('created_at', { ascending: false })
      .limit(20000)

    const runBuckets = new Set<string>(
      (recentRuns ?? []).map(r => String(r.created_at).slice(0, 16)) // YYYY-MM-DDTHH:MM
    )
    // TEMP (testing): monthly run cap disabled. Re-enable by removing the
    // `false &&` guard below once paid plans are live.
    if (false && runBuckets.size >= limits.runs) {
      return new Response(
        JSON.stringify({
          error: 'monthly_run_cap_reached',
          message: `Monthly cap of ${limits.runs} enrichment runs reached on the ${planTier} plan. Upgrade for more.`,
          run_cap: limits.runs,
          run_used: runBuckets.size,
          plan_tier: planTier,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // === Web-search enrichment (sole source in this version) ===
    // Paid waterfall (PDL / Apollo / Hunter / Clearbit / web_scrape) is intentionally
    // disabled below — see commented blocks. We rely on LLM web search via Perplexity
    // Sonar (or whichever model the org has selected for the `icp_enrichment` step).
    let mergedProspects: Prospect[] = []
    const sourcesUsed: string[] = []

    // Resolve model for icp_enrichment step (org override > available_models default > hardcoded fallback).
    let icpModelId = 'perplexity/sonar'
    {
      const { data: pref } = await db
        .from('org_model_preferences')
        .select('model_id, provider_key')
        .eq('org_id', orgId)
        .eq('step_key', 'icp_enrichment')
        .maybeSingle()
      if (pref?.model_id && pref.provider_key === 'openrouter') {
        icpModelId = pref.model_id
      } else {
        const { data: defaultModel } = await db
          .from('available_models')
          .select('model_id, provider_key')
          .contains('default_for_step_key', ['icp_enrichment'])
          .eq('is_active', true)
          .maybeSingle()
        if (defaultModel?.model_id && defaultModel.provider_key === 'openrouter') {
          icpModelId = defaultModel.model_id
        }
      }
    }

    // Look up org slug for OpenRouter HTTP-Referer attribution
    const { data: orgRow } = await db.from('orgs').select('slug').eq('id', orgId).maybeSingle()
    const orgSlug = (orgRow as any)?.slug as string | undefined

    let webSearchError: string | null = null
    try {
      const openrouterKey = await resolveApiKey(orgId, 'openrouter', 'user_or_platform')
      const webProspects = await enrichWebSearch(
        criteria,
        brand ?? null,
        openrouterKey,
        webSearchMax,
        orgSlug,
        icpModelId,
      )
      if (webProspects.length > 0) {
        mergedProspects = webProspects
        sourcesUsed.push('web_search')
      } else {
        webSearchError = 'Sonar returned 0 prospects (search may have found nothing matching the criteria, or the response could not be parsed). Try broadening industries / titles / keywords.'
        console.error('icp-enrich: web search returned 0 prospects')
      }
    } catch (err) {
      // resolveApiKey throws a Response object on failure; extract its body if possible.
      if (err instanceof Response) {
        try {
          const body = await err.clone().json()
          webSearchError = body?.error ?? 'OpenRouter API key not configured'
        } catch {
          webSearchError = 'OpenRouter API key not configured'
        }
      } else {
        webSearchError = `Web search failed: ${(err as Error).message ?? 'unknown error'}`
      }
      console.error('icp-enrich web_search error:', webSearchError)
    }

    /* === Paid provider waterfall — disabled in this version ===
     * To re-enable, uncomment each block. Each provider only runs if its API key
     * is set in the platform env (Deno.env). Web search results above remain.

    // Step 1: PDL
    const pdlKey = Deno.env.get('PDL_API_KEY')
    if (pdlKey) {
      try {
        const pdlProspects = await enrichPDL(criteria, pdlKey)
        if (pdlProspects.length > 0) {
          mergedProspects = pdlProspects
          sourcesUsed.push('pdl')
        }
      } catch (err) {
        console.error('PDL enrichment failed:', (err as Error).message)
      }
    }

    // Step 2: Apollo (merge with PDL, fill gaps)
    const apolloKey = Deno.env.get('APOLLO_API_KEY')
    if (apolloKey) {
      try {
        const apolloProspects = await enrichApollo(criteria, apolloKey)
        if (apolloProspects.length > 0) {
          mergedProspects = mergeProspects(mergedProspects, apolloProspects)
          if (!sourcesUsed.includes('apollo')) sourcesUsed.push('apollo')
        }
      } catch (err) {
        console.error('Apollo enrichment failed:', (err as Error).message)
      }
    }

    // Step 3: Hunter — fill missing emails
    const hunterKey = Deno.env.get('HUNTER_API_KEY')
    if (hunterKey) {
      for (const prospect of mergedProspects.filter(p => !p.email && p.company_domain)) {
        try {
          const { email } = await enrichHunter(prospect.company_domain!, hunterKey)
          if (email) {
            prospect.email = email
            if (!sourcesUsed.includes('hunter')) sourcesUsed.push('hunter')
          }
        } catch (err) {
          console.error(`Hunter failed for ${prospect.company_domain}:`, (err as Error).message)
        }
      }
    }

    // Step 4: Clearbit — fill missing company descriptions
    const clearbitKey = Deno.env.get('CLEARBIT_API_KEY')
    if (clearbitKey) {
      for (const prospect of mergedProspects.filter(p => !p.company_description && p.company_domain)) {
        try {
          const company = await enrichClearbit(prospect.company_domain!, clearbitKey)
          if (company.description) {
            prospect.company_description = company.description
            if (!sourcesUsed.includes('clearbit')) sourcesUsed.push('clearbit')
          }
        } catch (err) {
          console.error(`Clearbit failed for ${prospect.company_domain}:`, (err as Error).message)
        }
      }
    }

    // Step 5: Web scrape — final fallback for missing descriptions
    for (const prospect of mergedProspects.filter(p => !p.company_description && p.company_domain)) {
      try {
        const scraped = await scrapePublicProfile(`https://${prospect.company_domain}/about`)
        if (scraped.company_description) {
          prospect.company_description = scraped.company_description
          if (!sourcesUsed.includes('web_scrape')) sourcesUsed.push('web_scrape')
        }
      } catch (err) {
        console.error(`Web scrape failed for ${prospect.company_domain}:`, (err as Error).message)
      }
    }
    === end disabled paid waterfall === */

    // Compute ICP scores
    for (const prospect of mergedProspects) {
      (prospect as any).icp_score = computeIcpScore(prospect, criteria)
    }

    // UPSERT into prospects table
    const insertedProspects: any[] = []
    for (const prospect of mergedProspects) {
      const row: any = {
        org_id: orgId,
        first_name: prospect.first_name ?? null,
        last_name: prospect.last_name ?? null,
        email: prospect.email ?? null,
        linkedin_url: prospect.linkedin_url ?? null,
        job_title: prospect.title ?? null,
        company_name: prospect.company_name ?? null,
        company_domain: prospect.company_domain ?? null,
        company_description: prospect.company_description ?? null,
        company_size: prospect.company_size ?? null,
        industry: prospect.industry ?? null,
        country: prospect.country ?? null,
        icp_score: (prospect as any).icp_score,
        enrichment_source: prospect.enrichment_source ?? null,
        status: 'new',
      }

      // Lift web_search-specific fields out of enrichment_data into top-level columns
      if (prospect.enrichment_source === 'web_search') {
        const ed: any = prospect.enrichment_data ?? {}
        if (ed.icp_fit_reason) row.icp_fit_reason = ed.icp_fit_reason
        if (ed.location) row.location = ed.location
      }

      // Only store enrichment_data for non-scrape sources
      if (prospect.enrichment_source !== 'web_scrape' && prospect.enrichment_source !== 'apify_linkedin') {
        row.enrichment_data = prospect.enrichment_data ?? null
      }

      // Dedup: upsert on (org_id, linkedin_url) or email
      try {
        let result
        let upsertError: any = null
        if (prospect.linkedin_url) {
          const { data, error } = await db.from('prospects')
            .upsert(row, { onConflict: 'org_id,linkedin_url', ignoreDuplicates: false })
            .select()
            .single()
          result = data
          upsertError = error
        } else {
          const { data, error } = await db.from('prospects')
            .insert(row)
            .select()
            .single()
          result = data
          upsertError = error
        }
        if (upsertError) {
          console.error('Prospect upsert error:', upsertError.message, 'row:', {
            company: row.company_name, name: `${row.first_name} ${row.last_name}`,
          })
        }
        if (result) insertedProspects.push(result)
      } catch (err) {
        console.error('Prospect upsert failed:', (err as Error).message)
      }
    }

    // Persist a run record (best-effort — never block the response on logging failure).
    try {
      await db.from('icp_enrichment_runs').insert({
        org_id: orgId,
        user_id: user.id,
        criteria,
        model_id: icpModelId,
        source: 'web_search',
        max_results: webSearchMax,
        prospects_found: insertedProspects.length,
        prospect_ids: insertedProspects.map(p => p.id).filter(Boolean),
        warning: insertedProspects.length === 0 ? webSearchError : null,
        status: insertedProspects.length === 0 && webSearchError ? 'failed' : 'completed',
        error_message: insertedProspects.length === 0 && webSearchError ? webSearchError : null,
      })
    } catch (err) {
      console.error('icp-enrich: failed to log run', (err as Error).message)
    }

    return new Response(
      JSON.stringify({
        prospects: insertedProspects,
        total: insertedProspects.length,
        enrichment_sources_used: sourcesUsed,
        warning: insertedProspects.length === 0 ? webSearchError : null,
        limits: {
          plan_tier: planTier,
          byok_mode: byok,
          run_cap: limits.runs,
          run_used: runBuckets.size + (insertedProspects.length > 0 ? 1 : 0),
          max_per_run: limits.max_per_run,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof ProviderError) {
      const body = userMessageFor(err)
      const httpStatus = err.code === 'auth_failed' ? 401 : err.retryable ? 503 : 502
      return new Response(
        JSON.stringify(body),
        { status: httpStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    console.error('icp-enrich error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
