/**
 * dodopayments-webhook — PUBLIC endpoint. No JWT auth.
 * Verifies HMAC-SHA256 signature, then processes billing events.
 *
 * Non-negotiable: NO requireRole, NO validateJWT — HMAC is the auth.
 * CORS: not needed (Dodo calls this directly, not from a browser)
 */

const PLAN_TIERS: Record<string, { seat_limit: number; image_quota: number; video_quota: number }> = {
  starter: { seat_limit: 2, image_quota: 5, video_quota: 2 },
  growth: { seat_limit: 5, image_quota: 300, video_quota: 30 },
  scale: { seat_limit: 20, image_quota: 999999, video_quota: 100 },
}

import { createServiceClient } from '../_shared/db.ts'

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = Deno.env.get('DODO_WEBHOOK_SECRET')
  if (!secret) {
    console.error('dodopayments-webhook: DODO_WEBHOOK_SECRET not set')
    return new Response('Server misconfiguration', { status: 500 })
  }

  // Read raw body for signature verification
  const body = await req.text()

  const signature = req.headers.get('dodo-signature') ?? req.headers.get('x-signature')
  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

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
    if (!valid) {
      return new Response('Invalid signature', { status: 400 })
    }
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  // Return 200 immediately, process async
  const processEvent = async () => {
    let event: any
    try {
      event = JSON.parse(body)
    } catch {
      console.error('dodopayments-webhook: invalid JSON body')
      return
    }

    const db = createServiceClient()
    const eventType: string = event.type ?? event.event_type ?? ''
    const payload = event.data ?? event

    const customerId = payload.customer_id ?? payload.customer?.id

    switch (eventType) {
      case 'subscription.created':
      case 'subscription.updated': {
        const planName: string = (payload.plan_id ?? payload.product_id ?? payload.plan ?? '').toLowerCase()
        const tier = planName.includes('scale') ? 'scale'
          : planName.includes('growth') ? 'growth'
          : 'starter'

        const limits = PLAN_TIERS[tier]
        const subscriptionId = payload.subscription_id ?? payload.id

        await db
          .from('orgs')
          .update({
            plan_tier: tier,
            seat_limit: limits.seat_limit,
            image_quota: limits.image_quota,
            video_quota: limits.video_quota,
            dodo_subscription_id: subscriptionId,
          })
          .eq('dodo_customer_id', customerId)
        break
      }

      case 'subscription.cancelled':
      case 'subscription.deleted': {
        const starterLimits = PLAN_TIERS.starter
        await db
          .from('orgs')
          .update({
            plan_tier: 'starter',
            seat_limit: starterLimits.seat_limit,
            image_quota: starterLimits.image_quota,
            video_quota: starterLimits.video_quota,
          })
          .eq('dodo_customer_id', customerId)
        break
      }

      case 'invoice.paid':
      case 'payment.succeeded': {
        // Reset monthly quotas
        await db
          .from('orgs')
          .update({
            image_used: 0,
            video_used: 0,
            quota_reset_at: new Date().toISOString(),
          })
          .eq('dodo_customer_id', customerId)
        break
      }

      default:
        // Unknown event — log and ignore
        console.log(`dodopayments-webhook: unhandled event type: ${eventType}`)
    }
  }

  // Fire-and-forget processing
  processEvent().catch(err => console.error('dodopayments-webhook processing error:', err.message))

  return new Response('OK', { status: 200 })
})
