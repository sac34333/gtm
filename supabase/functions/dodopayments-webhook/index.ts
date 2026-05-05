/**
 * dodopayments-webhook — PUBLIC endpoint. No JWT auth.
 * Verifies HMAC-SHA256 signature, then processes billing events.
 *
 * Plan limits are looked up from subscription_plans (data-driven).
 * To add/change a plan: INSERT/UPDATE subscription_plans — no code deploy.
 *
 * Non-negotiable: NO requireRole, NO validateJWT — HMAC is the auth.
 */

import { createServiceClient } from '../_shared/db.ts'

// Fallback when subscription is cancelled or product_id not found.
const FREE_TIER = {
  tier_key: 'starter',
  seat_limit: 2,
  image_quota: 5,
  video_quota: 2,
  icp_quota: 0,
  brief_quota: 0,
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = Deno.env.get('DODO_WEBHOOK_SECRET')
  if (!secret) {
    console.error('dodopayments-webhook: DODO_WEBHOOK_SECRET not set')
    return new Response('Server misconfiguration', { status: 500 })
  }

  const body = await req.text()
  if (body.length > 1_000_000) return new Response('Payload too large', { status: 413 })

  const signature = req.headers.get('dodo-signature') ?? req.headers.get('x-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  // HMAC-SHA256 signature verification
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(body))
    if (!valid) return new Response('Invalid signature', { status: 400 })
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  // Return 200 immediately, process async
  const processEvent = async () => {
    let event: any
    try { event = JSON.parse(body) } catch {
      console.error('dodopayments-webhook: invalid JSON body')
      return
    }

    const db = createServiceClient()
    const eventType: string = event.type ?? event.event_type ?? ''
    const payload = event.data ?? event

    const customerId = payload.customer_id ?? payload.customer?.id
    if (!customerId) {
      console.error('dodopayments-webhook: missing customer_id', { eventType })
      return
    }

    // Resolve org by metadata.org_id (first checkout) or by customer_id (subsequent events).
    const metaOrgId: string | undefined = payload.metadata?.org_id
    let orgId: string | undefined
    if (metaOrgId) {
      orgId = metaOrgId
      // Backfill dodo_customer_id so future events resolve via customer_id.
      await db.from('orgs').update({ dodo_customer_id: customerId }).eq('id', orgId).is('dodo_customer_id', null)
    } else {
      const { data: org } = await db.from('orgs').select('id').eq('dodo_customer_id', customerId).maybeSingle()
      orgId = org?.id
    }
    if (!orgId) {
      console.error('dodopayments-webhook: no org found for customer', { customerId })
      return
    }

    switch (eventType) {
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.active':
      case 'subscription.renewed': {
        const productId: string | undefined = payload.product_id ?? payload.plan_id
        const subscriptionId = payload.subscription_id ?? payload.id

        // Look up plan limits from DB (data-driven)
        let plan: any = FREE_TIER
        if (productId) {
          const { data } = await db
            .from('subscription_plans')
            .select('tier_key, seat_limit, image_quota, video_quota, icp_quota, brief_quota, commitment_months, dodo_product_id')
            .eq('dodo_product_id', productId)
            .maybeSingle()
          if (data) plan = data
          else console.warn('dodopayments-webhook: unknown product_id, applying free tier', { productId })
        }

        const commitmentMonths = plan.commitment_months ?? 1
        const commitmentEndsAt = new Date()
        commitmentEndsAt.setMonth(commitmentEndsAt.getMonth() + commitmentMonths)

        await db.from('orgs').update({
          plan_tier:            plan.tier_key,
          seat_limit:           plan.seat_limit,
          image_quota:          plan.image_quota,
          video_quota:          plan.video_quota,
          dodo_subscription_id: subscriptionId,
          dodo_product_id:      productId ?? null,
          commitment_ends_at:   commitmentEndsAt.toISOString(),
        }).eq('id', orgId)
        break
      }

      case 'subscription.cancelled':
      case 'subscription.deleted':
      case 'subscription.expired': {
        await db.from('orgs').update({
          plan_tier:            FREE_TIER.tier_key,
          seat_limit:           FREE_TIER.seat_limit,
          image_quota:          FREE_TIER.image_quota,
          video_quota:          FREE_TIER.video_quota,
          dodo_subscription_id: null,
          dodo_product_id:      null,
          commitment_ends_at:   null,
        }).eq('id', orgId)
        break
      }

      case 'invoice.paid':
      case 'payment.succeeded':
      case 'subscription.renewed.payment_succeeded': {
        await db.from('orgs').update({
          image_used:     0,
          video_used:     0,
          quota_reset_at: new Date().toISOString(),
        }).eq('id', orgId)
        break
      }

      default:
        console.log(`dodopayments-webhook: unhandled event type: ${eventType}`)
    }
  }

  processEvent().catch(err => console.error('dodopayments-webhook processing error:', err.message))
  return new Response('OK', { status: 200 })
})
