import type { ICPCriteria, Prospect } from './types.ts'

const PDL_BASE = 'https://api.peopledatalabs.com/v5'

function mapCompanySize(size: string): string {
  // PDL company size ranges: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+
  switch (size) {
    case 'smb': return '1-200'
    case 'mid-market': return '201-1000'
    case 'enterprise': return '1001+'
    default: return size
  }
}

export async function enrichPDL(
  criteria: ICPCriteria,
  apiKey: string,
): Promise<Prospect[]> {
  const conditions: string[] = []

  if (criteria.industries?.length) {
    const vals = criteria.industries.map(i => `"${i}"`).join(' OR ')
    conditions.push(`job_company_industry:(${vals})`)
  }
  if (criteria.geographies?.length) {
    const vals = criteria.geographies.map(g => `"${g}"`).join(' OR ')
    conditions.push(`location_country:(${vals})`)
  }
  if (criteria.titles?.length) {
    const vals = criteria.titles.map(t => `"${t}"`).join(' OR ')
    conditions.push(`job_title:(${vals})`)
  }
  if (criteria.company_sizes?.length) {
    const vals = criteria.company_sizes.map(mapCompanySize).map(s => `"${s}"`).join(' OR ')
    conditions.push(`job_company_size:(${vals})`)
  }
  if (criteria.domains?.length) {
    const vals = criteria.domains.map(d => `"${d}"`).join(' OR ')
    conditions.push(`job_company_website:(${vals})`)
  }

  if (conditions.length === 0) return []

  const query = conditions.join(' AND ')

  const res = await fetch(`${PDL_BASE}/person/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: { bool: { must: conditions.map(c => ({ query_string: { query: c } })) } },
      size: 100,
      pretty: false,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PDL error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const results: any[] = data.data ?? []

  return results.map((p: any): Prospect => {
    const nameParts = (p.full_name ?? '').split(' ')
    return {
      first_name: nameParts[0] ?? null,
      last_name: nameParts.slice(1).join(' ') || null,
      email: p.work_email ?? null,
      linkedin_url: p.linkedin_url ?? null,
      title: p.job_title ?? null,
      company_name: p.job_company_name ?? null,
      company_domain: p.job_company_website ?? null,
      company_description: p.job_company_description ?? null,
      company_size: p.job_company_employee_count ?? null,
      industry: p.industry ?? null,
      country: p.location_country ?? null,
      enrichment_source: 'pdl',
      enrichment_data: p,
    }
  })
}
