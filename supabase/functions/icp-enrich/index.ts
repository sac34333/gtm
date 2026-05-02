import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { enrichPDL } from '../_shared/enrichment/pdl.ts'
import { enrichApollo } from '../_shared/enrichment/apollo.ts'
import { enrichHunter } from '../_shared/enrichment/hunter.ts'
import { enrichClearbit } from '../_shared/enrichment/clearbit.ts'
import { scrapePublicProfile } from '../_shared/enrichment/web_scrape.ts'
import type { ICPCriteria, Prospect } from '../_shared/enrichment/types.ts'

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

    // Save criteria to brand_contexts.last_icp_criteria
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

    // Full waterfall enrichment
    let mergedProspects: Prospect[] = []
    const sourcesUsed: string[] = []

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

      // Only store enrichment_data for non-scrape sources
      if (prospect.enrichment_source !== 'web_scrape' && prospect.enrichment_source !== 'apify_linkedin') {
        row.enrichment_data = prospect.enrichment_data ?? null
      }

      // Dedup: upsert on (org_id, linkedin_url) or email
      try {
        let result
        if (prospect.linkedin_url) {
          const { data } = await db.from('prospects')
            .upsert(row, { onConflict: 'org_id,linkedin_url', ignoreDuplicates: false })
            .select()
            .single()
          result = data
        } else {
          const { data } = await db.from('prospects')
            .insert(row)
            .select()
            .single()
          result = data
        }
        if (result) insertedProspects.push(result)
      } catch (err) {
        console.error('Prospect upsert failed:', (err as Error).message)
      }
    }

    return new Response(
      JSON.stringify({
        prospects: insertedProspects,
        total: insertedProspects.length,
        enrichment_sources_used: sourcesUsed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('icp-enrich error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
