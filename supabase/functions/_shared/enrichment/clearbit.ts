import type { CompanyData } from './types.ts'

const CLEARBIT_BASE = 'https://company.clearbit.com/v2'

export async function enrichClearbit(
  domain: string,
  apiKey: string,
): Promise<CompanyData> {
  const url = `${CLEARBIT_BASE}/companies/find?domain=${encodeURIComponent(domain)}`

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Clearbit error ${res.status}: ${text}`)
  }

  const data = await res.json()

  return {
    name: data.name ?? null,
    description: data.description ?? null,
    employee_count: data.metrics?.employees ?? null,
    industry: data.category?.industry ?? null,
    country: data.geo?.country ?? null,
  }
}
