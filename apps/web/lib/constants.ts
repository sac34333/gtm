// ─── Country list (ISO 3166-1 alpha-2 + display name) ────────────────────────

export const COUNTRIES = [
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CN', name: 'China' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EG', name: 'Egypt' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'IL', name: 'Israel' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'JP', name: 'Japan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NO', name: 'Norway' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TH', name: 'Thailand' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'VN', name: 'Vietnam' },
]

// ─── Industries ───────────────────────────────────────────────────────────────
// Aligned to standard B2B sales/firmographic taxonomies (LinkedIn, Apollo, ZoomInfo).
// Ordered by typical buyer-relevance for AI / SaaS / consulting GTM.

export const INDUSTRIES = [
  // Tech & software
  'Software / SaaS',
  'Information Technology & Services',
  'Computer Software',
  'Internet',
  'Artificial Intelligence',
  'Cybersecurity',
  'Cloud Infrastructure',
  'Data & Analytics',
  'DevTools / Developer Platforms',

  // Financial & professional services
  'Financial Services',
  'Banking',
  'Insurance',
  'Investment Management',
  'FinTech',
  'Accounting',
  'Management Consulting',
  'Legal Services',
  'Professional Services',
  'Staffing & Recruiting',

  // Marketing & media
  'Marketing & Advertising',
  'Public Relations & Communications',
  'Media Production',
  'Online Media',
  'Publishing',
  'Entertainment',

  // Healthcare & life sciences
  'Healthcare',
  'Hospital & Health Care',
  'Pharmaceuticals',
  'Biotechnology',
  'Medical Devices',
  'Health Tech',

  // Industrial & physical
  'Manufacturing',
  'Industrial Automation',
  'Automotive',
  'Aerospace & Defense',
  'Construction',
  'Real Estate',
  'PropTech',
  'Logistics & Supply Chain',
  'Transportation',

  // Consumer & commerce
  'Retail',
  'E-commerce',
  'Consumer Goods',
  'Food & Beverage',
  'Hospitality',
  'Travel & Leisure',

  // Energy & resources
  'Energy',
  'Renewables / CleanTech',
  'Oil & Gas',
  'Utilities',
  'Mining & Metals',

  // Public & social
  'Government / Public Sector',
  'Education',
  'EdTech',
  'Higher Education',
  'Non-profit',
  'Research',

  // Telecom
  'Telecommunications',

  'Other',
]

// ─── Company sizes ────────────────────────────────────────────────────────────

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+']

// ─── ICP company sizes ────────────────────────────────────────────────────────

export const ICP_COMPANY_SIZES = ['SMB', 'Mid-market', 'Enterprise']

// ─── Revenue models ───────────────────────────────────────────────────────────

export const REVENUE_MODELS = ['SaaS', 'Consulting', 'Product', 'Marketplace', 'Other']

// ─── Platforms ────────────────────────────────────────────────────────────────

export const PLATFORMS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter_x', label: 'Twitter / X' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp_business', label: 'WhatsApp Business' },
  { value: 'email', label: 'Email' },
]

// ─── Timezones ────────────────────────────────────────────────────────────────

export const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
]
