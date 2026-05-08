import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { decrypt } from '../_shared/encryption.ts'

const LI_BASE = 'https://api.linkedin.com'
const LI_VERSION = '202501'

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
      .select('encrypted_access_token')
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

    // 1. Get member display name (r_basicprofile / openid)
    const meRes = await fetch(`${LI_BASE}/v2/me?projection=(id,localizedFirstName,localizedLastName)`, { headers: hdrs })
    if (!meRes.ok) {
      return new Response(JSON.stringify({ error: 'linkedin_auth_failed' }), { status: 401, headers: corsHeaders })
    }
    const me = await meRes.json()
    const memberName = [me.localizedFirstName, me.localizedLastName].filter(Boolean).join(' ') || 'You'

    // 2. Find orgs this member administers using r_organization_admin scope.
    //    (Personal posts skipped - r_member_social not available in current app scopes.)
    type OrgInfo = { urn: string; name: string }
    const orgs: OrgInfo[] = []
    try {
      const aclRes = await fetch(
        `${LI_BASE}/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED` +
        `&projection=(elements*(organization~(id,localizedName)))`,
        { headers: hdrs },
      )
      if (aclRes.ok) {
        const aclJson = await aclRes.json()
        for (const el of (aclJson.elements ?? [])) {
          const org = el['organization~']
          if (org?.id) {
            orgs.push({ urn: `urn:li:organization:${org.id}`, name: org.localizedName ?? 'Company' })
          }
        }
        console.log(`Found ${orgs.length} admin orgs`)
      } else {
        const body = await aclRes.text()
        console.error(`organizationAcls failed: ${aclRes.status} ${body.slice(0, 300)}`)
      }
    } catch (e) {
      console.error('organizationAcls error:', (e as Error).message)
    }

    // 3. Fetch posts for each org using r_organization_social scope
    const fetchOrgPosts = async (orgUrn: string): Promise<any[]> => {
      const url = `${LI_BASE}/rest/posts?q=authors&authors=List(${encodeURIComponent(orgUrn)})&count=20`
      try {
        const res = await fetch(url, { headers: hdrs })
        const body = await res.text()
        if (!res.ok) {
          console.error(`org posts error ${orgUrn}: ${res.status} ${body.slice(0, 300)}`)
          return []
        }
        let json: any
        try { json = JSON.parse(body) } catch { return [] }
        console.log(`org posts ${orgUrn}: elements=${json?.elements?.length ?? 0}`)
        return Array.isArray(json.elements) ? json.elements : []
      } catch (e) {
        console.error(`org posts fetch error ${orgUrn}:`, (e as Error).message)
        return []
      }
    }

    const allOrgRaw = await Promise.all(orgs.map(o => fetchOrgPosts(o.urn)))

    const parsePost = (p: any, orgInfo: OrgInfo) => {
      const text: string = p.commentary ?? ''
      const mediaType: string | null = p.content?.media ? 'IMAGE'
        : p.content?.article ? 'ARTICLE'
        : p.content?.multiImage ? 'IMAGE'
        : null
      const postId = String(p.id ?? '')
      return {
        id: postId,
        text: text.slice(0, 600),
        publishedAt: p.publishedAt ? new Date(Number(p.publishedAt)).toISOString()
          : p.createdAt ? new Date(Number(p.createdAt)).toISOString()
          : null,
        type: 'org' as const,
        authorName: orgInfo.name,
        mediaType,
        postUrl: `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}`,
      }
    }

    const posts = orgs
      .flatMap((orgInfo, i) => allOrgRaw[i].map((p: any) => parsePost(p, orgInfo)))
      .sort((a, b) => {
        if (!a.publishedAt) return 1
        if (!b.publishedAt) return -1
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      })
      .slice(0, 20)

    const orgName = orgs[0]?.name ?? null

    return new Response(
      JSON.stringify({
        posts,
        memberName,
        orgName,
        // Expose org list so the compose dialog can build org selector
        orgs: orgs.map(o => ({ urn: o.urn, name: o.name })),
      }),
      { status: 200, headers: corsHeaders },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('get-linkedin-posts error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
