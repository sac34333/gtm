const HUNTER_BASE = 'https://api.hunter.io/v2'

export async function enrichHunter(
  domain: string,
  apiKey: string,
): Promise<{ email: string | null }> {
  const url = `${HUNTER_BASE}/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`

  const res = await fetch(url)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Hunter error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const pattern = data.data?.pattern ?? null
  const domain_ = data.data?.domain ?? domain

  // Construct most likely email from pattern + first available email
  const emails: any[] = data.data?.emails ?? []
  if (emails.length > 0 && emails[0].value) {
    return { email: emails[0].value }
  }

  return { email: null }
}
