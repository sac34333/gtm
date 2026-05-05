/**
 * create-checkout-session — JWT-protected.
 * Looks up plan by Dodo product_id from subscription_plans, then creates
 * a Dodo subscription with payment_link=true. Returns the hosted checkout URL.
 *
 * Env required:
 *   DODO_PAYMENTS_API_KEY   — LIVE-mode API key
 *   DODO_PAYMENTS_BASE_URL  — defaults to https://live.dodopayments.com
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'

const json = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
  })

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return json(req, 405, { error: 'method not allowed' })

  // ── JWT first ──
  let user: any, jwt: string
  try {
    const v = await validateJWT(req)
    user = v.user
    jwt = v.jwt
  } catch (resp) {
    return resp instanceof Response ? resp : json(req, 401, { error: 'unauthorized' })
  }
  void jwt

  let orgId: string
  try { orgId = extractOrgId(user) } catch (resp) {
    return resp instanceof Response ? resp : json(req, 401, { error: 'unauthorized' })
  }

  // ── Body validation ──
  const raw = await req.text()
  if (raw.length > 4096) return json(req, 413, { error: 'payload too large' })
  let body: { product_id?: string; return_url?: string }
  try { body = JSON.parse(raw) } catch { return json(req, 400, { error: 'invalid json' }) }

  const productId = (body.product_id ?? '').trim()
  const returnUrl = (body.return_url ?? '').trim()
  if (!productId || productId.length > 128) return json(req, 400, { error: 'invalid product_id' })
  if (!returnUrl || !/^https?:\/\//.test(returnUrl) || returnUrl.length > 512) {
    return json(req, 400, { error: 'invalid return_url' })
  }

  const apiKey = Deno.env.get('DODO_PAYMENTS_API_KEY')
  if (!apiKey) {
    console.error('create-checkout-session: DODO_PAYMENTS_API_KEY not set')
    return json(req, 500, { error: 'billing not configured' })
  }
  const baseUrl = (Deno.env.get('DODO_PAYMENTS_BASE_URL') ?? 'https://live.dodopayments.com').replace(/\/$/, '')

  const db = createServiceClient()

  // ── Validate product_id is a known active plan ──
  const { data: plan, error: planErr } = await db
    .from('subscription_plans')
    .select('dodo_product_id, tier_key, display_name')
    .eq('dodo_product_id', productId)
    .eq('is_active', true)
    .maybeSingle()
  if (planErr || !plan) return json(req, 404, { error: 'plan not found' })

  // ── Load org for customer info ──
  const { data: org, error: orgErr } = await db
    .from('orgs')
    .select('id, name, dodo_customer_id, country_code')
    .eq('id', orgId)
    .single()
  if (orgErr || !org) return json(req, 404, { error: 'org not found' })

  // Build customer block — reuse existing dodo_customer_id if present
  const customer = org.dodo_customer_id
    ? { customer_id: org.dodo_customer_id }
    : {
        email: user.email,
        name: org.name ?? user.email,
        create_new_customer: true,
      }

  // Minimal billing address — Dodo requires it. Real values collected on hosted page.
  const billing = {
    city: 'N/A',
    country: (org.country_code && /^[A-Z]{2}$/.test(org.country_code)) ? org.country_code : 'US',
    state: 'N/A',
    street: 'N/A',
    zipcode: '00000',
  }

  const dodoBody = {
    billing,
    customer,
    product_id: productId,
    quantity: 1,
    payment_link: true,
    return_url: returnUrl,
    metadata: { org_id: orgId, tier_key: plan.tier_key },
  }

  let dodoResp: Response
  try {
    dodoResp = await fetch(`${baseUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dodoBody),
    })
  } catch {
    return json(req, 502, { error: 'billing provider unreachable' })
  }

  const dodoText = await dodoResp.text()
  if (!dodoResp.ok) {
    console.error('create-checkout-session: dodo error', dodoResp.status, dodoText.slice(0, 500))
    return json(req, 502, { error: 'billing provider error' })
  }

  let dodo: any
  try { dodo = JSON.parse(dodoText) } catch {
    return json(req, 502, { error: 'invalid billing response' })
  }

  const url = dodo.payment_link ?? dodo.checkout_url ?? dodo.url
  const newCustomerId = dodo.customer?.customer_id ?? dodo.customer_id
  if (!url) {
    console.error('create-checkout-session: no payment URL in response')
    return json(req, 502, { error: 'no checkout url returned' })
  }

  // Persist customer_id for next time (don't fail the request if this update fails)
  if (newCustomerId && !org.dodo_customer_id) {
    await db.from('orgs').update({ dodo_customer_id: newCustomerId }).eq('id', orgId)
  }

  return json(req, 200, { url })
})
