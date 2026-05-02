import type { ICPCriteria, Prospect } from './types.ts'

const APOLLO_BASE = 'https://api.apollo.io/v1'

function mapEmployeeRange(size: string): string {
  switch (size) {
    case 'smb': return '1,200'
    case 'mid-market': return '201,1000'
    case 'enterprise': return '1001,10000000'
    default: return '1,10000000'
  }
}

export async function enrichApollo(
  criteria: ICPCriteria,
  apiKey: string,
): Promise<Prospect[]> {
  const body: any = {
    api_key: apiKey,
    page: 1,
    per_page: 100,
  }

  if (criteria.titles?.length) {
    body.person_titles = criteria.titles
  }
  if (criteria.geographies?.length) {
    body.person_locations = criteria.geographies
  }
  if (criteria.company_sizes?.length) {
    body.organization_num_employees_ranges = criteria.company_sizes.map(mapEmployeeRange)
  }
  if (criteria.domains?.length) {
    body.organization_domains = criteria.domains
  }

  const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apollo error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const people: any[] = data.people ?? []

  return people.map((p: any): Prospect => ({
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    email: p.email ?? null,
    linkedin_url: p.linkedin_url ?? null,
    title: p.title ?? null,
    company_name: p.organization?.name ?? null,
    company_domain: p.organization?.website_url?.replace(/^https?:\/\//, '').split('/')[0] ?? null,
    company_description: p.organization?.short_description ?? null,
    company_size: p.organization?.employee_count?.toString() ?? null,
    industry: p.organization?.industry ?? null,
    country: p.country ?? null,
    enrichment_source: 'apollo',
    enrichment_data: p,
  }))
}
