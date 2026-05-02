export interface ICPCriteria {
  industries?: string[]
  company_sizes?: string[]
  geographies?: string[]
  titles?: string[]
  keywords?: string[]
  domains?: string[]
}

export interface Prospect {
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
}

export interface CompanyData {
  name?: string | null
  description?: string | null
  employee_count?: number | null
  industry?: string | null
  country?: string | null
}
