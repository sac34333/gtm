import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { decrypt } from '../_shared/encryption.ts'

const LI_BASE = 'https://api.linkedin.com'
const LI_VERSION = '202401'

function liHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': LI_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: corsHeaders })
  }

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    const { data: conn } = await db
      .from('org_linkedin_connections')
      .select('encrypted_access_token, ad_account_urn')
      .eq('org_id', orgId)
      .single()

    if (!conn) {
      return new Response(JSON.stringify({ error: 'not_connected' }), { status: 404, headers: corsHeaders })
    }

    let token: string
    try {
      token = await decrypt(conn.encrypted_access_token)
    } catch {
      return new Response(JSON.stringify({ error: 'token_decrypt_failed' }), { status: 500, headers: corsHeaders })
    }

    const hdrs = liHeaders(token)

    // 1. Get member URN + name
    const meRes = await fetch(`${LI_BASE}/v2/me?projection=(id,localizedFirstName,localizedLastName)`, { headers: hdrs })
    if (!meRes.ok) {
      return new Response(JSON.stringify({ error: 'linkedin_auth_failed' }), { status: 401, headers: corsHeaders })
    }
    const me = await meRes.json()
    const memberUrn = `urn:li:person:${me.id}`
    const memberName = [me.localizedFirstName, me.localizedLastName].filter(Boolean).join(' ') || 'You'

    // 2. Try to get org URN from the ad account's reference field
    let orgUrn: string | null = null
    let orgName: string | null = null
    const accountId = conn.ad_account_urn.split(':').pop()
    try {
      const acctRes = await fetch(`${LI_BASE}/rest/adAccounts/${accountId}`, { headers: hdrs })
      if (acctRes.ok) {
        const acct = await acctRes.json()
        if (typeof acct.reference === 'string' && acct.reference.startsWith('urn:li:organization:')) {
          orgUrn = acct.reference
          orgName = acct.name ?? null
        }
      }
    } catch { /* non-fatal */ }

    // 3. Fetch posts for member (and org if available)
    const fetchUgcPosts = async (authorUrn: string): Promise<any[]> => {
      const url = `${LI_BASE}/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(authorUrn)})&count=10&sortBy=LAST_MODIFIED`
      try {
        const res = await fetch(url, { headers: hdrs })
        if (!res.ok) return []
        const json = await res.json()
        return Array.isArray(json.elements) ? json.elements : []
      } catch {
        return []
      }
    }

    const [personalRaw, orgRaw] = await Promise.all([
      fetchUgcPosts(memberUrn),
      orgUrn ? fetchUgcPosts(orgUrn) : Promise.resolve([]),
    ])

    const parsePost = (p: any, type: 'personal' | 'org', authorName: string) => {
      const ugcShare = p.specificContent?.['com.linkedin.ugc.ShareContent']
      const text: string = ugcShare?.shareCommentary?.text ?? ''
      const firstMedia = ugcShare?.media?.[0]
      return {
        id: String(p.id ?? ''),
        text: text.slice(0, 600),
        publishedAt: p.created?.time ? new Date(Number(p.created.time)).toISOString() : null,
        type,
        authorName,
        mediaType: firstMedia?.mediaType ?? null, // 'IMAGE', 'VIDEO', 'ARTICLE', null
        postUrl: `https://www.linkedin.com/feed/update/${encodeURIComponent(String(p.id ?? ''))}`,
      }
    }

    const posts = [
      ...personalRaw.map((p: any) => parsePost(p, 'personal', memberName)),
      ...orgRaw.map((p: any) => parsePost(p, 'org', orgName ?? 'Company')),
    ]
      .sort((a, b) => {
        if (!a.publishedAt) return 1
        if (!b.publishedAt) return -1
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      })
      .slice(0, 15)

    return new Response(
      JSON.stringify({ posts, memberName, orgName }),
      { status: 200, headers: corsHeaders },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('get-linkedin-posts error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
