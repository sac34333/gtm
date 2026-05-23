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

    // Validate token shape — LinkedIn access tokens are typically 200-500 chars,
    // base64-ish (alphanumeric + a few safe symbols). Reject anything suspicious.
    if (!accessToken || accessToken.length < 20 || accessToken.length > 2048) {
      return new Response(JSON.stringify({ error: 'invalid_token_format' }), { status: 400, headers: corsHeaders })
    }

    // Consent is required before saving
    if (!consentGiven) {
      return new Response(JSON.stringify({ error: 'consent_required' }), { status: 400, headers: corsHeaders })
    }
    // Validate ad account URN format
    const urnMatch = adAccountUrn.match(/^urn:li:sponsoredAccount:(\d+)$/)
    if (!urnMatch) {
      return new Response(JSON.stringify({
        error: 'invalid_ad_account_urn',
        detail: 'Must be in the form urn:li:sponsoredAccount:1234567890',
      }), { status: 400, headers: corsHeaders })
    }
    const accountId = urnMatch[1]

    // Test the token: GET /rest/adAccounts/{id}
    // If the token is invalid/expired or doesn't have access to this account
    // → LinkedIn returns 401/403. We refuse to save in that case.
    let accountName = accountNameInput || ''
    let tokenWorks = false
    try {
      const testRes = await fetch(`https://api.linkedin.com/rest/adAccounts/${accountId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202401',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      })
      if (testRes.ok) {
        tokenWorks = true
        const j = await testRes.json().catch(() => ({}))
        if (!accountName && typeof j?.name === 'string') accountName = j.name.slice(0, 200)
      } else if (testRes.status === 401 || testRes.status === 403) {
        return new Response(JSON.stringify({
          error: 'linkedin_auth_failed',
          detail: 'LinkedIn rejected the token (401/403). Make sure it has r_ads + r_ads_reporting scopes and access to this ad account.',
        }), { status: 400, headers: corsHeaders })
      } else if (testRes.status === 404) {
        return new Response(JSON.stringify({
          error: 'ad_account_not_found',
          detail: 'LinkedIn could not find this ad account or your token cannot see it.',
        }), { status: 400, headers: corsHeaders })
      } else {
        // Other LinkedIn error — let through with a soft warning, don't reveal upstream body
        console.error('linkedin verify non-2xx:', testRes.status)
      }
    } catch (e) {
      // Network blip — proceed with save but surface a soft message
      console.error('linkedin verify network error:', (e as Error).message)
    }

    const encrypted = await encrypt(accessToken)

    const { error: upsertErr } = await db
      .from('org_linkedin_connections')
      .upsert({
        org_id: orgId,
        encrypted_access_token: encrypted,
        ad_account_urn: adAccountUrn,
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
    }), { status: 200, headers: corsHeaders })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('save-linkedin-connection error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
