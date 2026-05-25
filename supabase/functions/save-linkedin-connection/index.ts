import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'
import { encrypt } from '../_shared/encryption.ts'

// POST { access_token, ad_account_urn, account_name? }
// 1) Validates inputs.
// 2) Tests the token against LinkedIn API (one cheap GET) — rejects if 401/403.
// 3) Encrypts the token (AES-256-GCM) and upserts.
// Never logs the token. Never returns the token.
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: corsHeaders })
  }

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > 4096) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers: corsHeaders })
    }

    const body = await req.json().catch(() => ({}))
    const accessToken = typeof body?.access_token === 'string' ? body.access_token.trim() : ''
const adAccountUrn = typeof body?.ad_account_urn === 'string' ? body.ad_account_urn.trim() : ''
    const accountNameInput = typeof body?.account_name === 'string' ? body.account_name.trim().slice(0, 200) : ''
    const consentGiven = body?.consent_given === true

    // Validate token
    if (!accessToken || accessToken.length < 20 || accessToken.length > 2048) {
      return new Response(JSON.stringify({ error: 'invalid_token_format' }), { status: 400, headers: corsHeaders })
    }

    // Consent is required before saving
    if (!consentGiven) {
      return new Response(JSON.stringify({ error: 'consent_required' }), { status: 400, headers: corsHeaders })
    }

    // Ad account URN is optional — only needed for ad analytics
    let accountId = ''
    if (adAccountUrn) {
      const urnMatch = adAccountUrn.match(/^urn:li:sponsoredAccount:(\d+)$/)
      if (!urnMatch) {
        return new Response(JSON.stringify({
          error: 'invalid_ad_account_urn',
          detail: 'Must be in the form urn:li:sponsoredAccount:1234567890 — or leave blank if you don\'t have an ad account.',
        }), { status: 400, headers: corsHeaders })
      }
      accountId = urnMatch[1]
    }

    // Test the token: try /rest/orgAccounts first (works for all org tokens),
    // then try /rest/adAccounts (only works if token has ads access).
    // We save the connection as long as ORG access works — ads access is optional.
    let accountName = accountNameInput || ''
    let tokenWorks = false
    let hasAdsAccess = false

    try {
      // Test 1: Organization access (w_organization_social / r_organization_admin)
      const orgRes = await fetch('https://api.linkedin.com/rest/orgAccounts?q=verifiedAccounts', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202501',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      })

      if (orgRes.ok) {
        tokenWorks = true
      } else if (orgRes.status === 401 || orgRes.status === 403) {
        const detail = orgRes.status === 401
          ? 'LinkedIn rejected the token as unauthorized (401). The token may be expired or invalid.'
          : 'LinkedIn rejected the token (403). Make sure it has w_organization_social or r_organization_admin scope.'
        return new Response(JSON.stringify({
          error: 'linkedin_auth_failed',
          detail,
        }), { status: 400, headers: corsHeaders })
      }
    } catch (e) {
      console.error('linkedin org verify network error:', (e as Error).message)
    }

    // Test 2: Ads access (optional — only needed for campaign analytics)
    if (tokenWorks && accountId) {
      try {
        const adRes = await fetch(`https://api.linkedin.com/rest/adAccounts/${accountId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202401',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        })
        if (adRes.ok) {
          hasAdsAccess = true
          const j = await adRes.json().catch(() => ({}))
          if (!accountName && typeof j?.name === 'string') accountName = j.name.slice(0, 200)
        }
      } catch (e) {
        console.error('linkedin ads verify network error:', (e as Error).message)
      }
    }

    const encrypted = await encrypt(accessToken)

    const { error: upsertErr } = await db
      .from('org_linkedin_connections')
      .upsert({
        org_id: orgId,
        encrypted_access_token: encrypted,
        ad_account_urn: adAccountUrn || null,
        account_name: accountName || null,
        granted_scopes: [], // unknown for paste-based flow
        token_expires_at: null,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        consent_given_at: new Date().toISOString(),
        consent_given_by: user.id,
      }, { onConflict: 'org_id' })

    if (upsertErr) {
      console.error('linkedin upsert error:', upsertErr.message)
      return new Response(JSON.stringify({ error: 'save_failed' }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({
      connected: true,
      account_name: accountName || null,
      verified: tokenWorks,
      has_ads_access: hasAdsAccess,
    }), { status: 200, headers: corsHeaders })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('save-linkedin-connection error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
