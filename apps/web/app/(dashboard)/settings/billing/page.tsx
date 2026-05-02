'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useOrgStore } from '@/store/org.store'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle2, CreditCard, Zap } from 'lucide-react'
import { format } from 'date-fns'

// ─── Plan definitions ─────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$49/mo',
    seats: 2,
    images: 50,
    videos: 5,
    color: 'border-slate-600',
    badge: 'bg-slate-700 text-slate-200',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$149/mo',
    seats: 5,
    images: 300,
    videos: 30,
    color: 'border-indigo-500/50',
    badge: 'bg-indigo-500/20 text-indigo-300',
  },
  {
    id: 'scale',
    name: 'Scale',
    price: '$399/mo',
    seats: 20,
    images: 'Unlimited',
    videos: 100,
    color: 'border-purple-500/50',
    badge: 'bg-purple-500/20 text-purple-300',
  },
]

// ─── Dodo checkout helper ─────────────────────────────────────────────────────

const DODO_PRODUCT_IDS: Record<string, string> = {
  growth: process.env.NEXT_PUBLIC_DODO_PRODUCT_GROWTH ?? '',
  scale: process.env.NEXT_PUBLIC_DODO_PRODUCT_SCALE ?? '',
}

async function createCheckoutSession(planId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const { data: orgData } = await supabase
    .from('orgs')
    .select('dodo_customer_id')
    .eq('id', session?.user.app_metadata?.org_id)
    .single()

  const productId = DODO_PRODUCT_IDS[planId]
  if (!productId) throw new Error('Product not configured')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin

  const resp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      product_id: productId,
      customer_id: orgData?.dodo_customer_id,
      return_url: `${appUrl}/settings/billing`,
    }),
  })

  if (!resp.ok) throw new Error('Failed to create checkout session')
  const data = await resp.json()
  return data.url
}

// ─── Org data ─────────────────────────────────────────────────────────────────

interface OrgBillingData {
  plan_tier: string
  seat_limit: number
  image_quota: number
  video_quota: number
  image_used: number
  video_used: number
  quota_reset_at: string | null
  dodo_customer_id: string | null
}

async function fetchOrgBilling(): Promise<OrgBillingData> {
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.org_id
  const { data, error } = await supabase
    .from('orgs')
    .select('plan_tier, seat_limit, image_quota, video_quota, image_used, video_used, quota_reset_at, dodo_customer_id')
    .eq('id', orgId)
    .single()
  if (error || !data) throw new Error('Failed to load billing data')
  return data as OrgBillingData
}

async function fetchSeatCount(orgId: string): Promise<number> {
  const { count } = await supabase
    .from('org_members')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'active')
  return count ?? 0
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsBillingPage() {
  const { userRole, org } = useOrgStore()
  const isOwner = userRole === 'owner'

  const { data, isLoading, isError, refetch } = useQuery<OrgBillingData>({
    queryKey: ['org-billing'],
    queryFn: fetchOrgBilling,
    staleTime: 30_000,
  })

  const { data: seatCount } = useQuery<number>({
    queryKey: ['seat-count', org?.id],
    queryFn: () => fetchSeatCount(org!.id),
    enabled: !!org?.id,
  })

  const [upgrading, setUpgrading] = useState<string | null>(null)

  async function handleUpgrade(planId: string) {
    setUpgrading(planId)
    try {
      const url = await createCheckoutSession(planId)
      window.location.href = url
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to start checkout')
    } finally {
      setUpgrading(null)
    }
  }

  if (isLoading) return <BillingLoading />

  if (isError) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12 space-y-4">
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-red-300">Failed to load billing data.</p>
          <Button variant="outline" className="border-white/10 text-white" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const imagePercent = data ? Math.min(100, (data.image_used / Math.max(data.image_quota, 1)) * 100) : 0
  const videoPercent = data ? Math.min(100, (data.video_used / Math.max(data.video_quota, 1)) * 100) : 0
  const seatPercent = data && seatCount != null
    ? Math.min(100, (seatCount / Math.max(data.seat_limit, 1)) * 100) : 0

  const currentPlan = PLANS.find(p => p.id === data?.plan_tier) ?? PLANS[0]
  const resetDate = data?.quota_reset_at
    ? format(new Date(data.quota_reset_at), 'MMM d, yyyy')
    : null

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your plan and usage quotas.</p>
      </div>

      {/* Current plan card */}
      <div className="rounded-xl border border-white/8 bg-white/4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Current Plan</h2>
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${currentPlan.badge}`}>
            {currentPlan.name}
          </span>
        </div>

        <div className="space-y-4">
          {/* Images meter */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Images used</span>
              <span className="text-slate-400">
                {data?.image_used ?? 0} / {data?.image_quota === 999999 ? 'Unlimited' : data?.image_quota}
              </span>
            </div>
            <Progress value={imagePercent} className="h-2 bg-white/10" />
          </div>

          {/* Videos meter */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Videos used</span>
              <span className="text-slate-400">{data?.video_used ?? 0} / {data?.video_quota}</span>
            </div>
            <Progress value={videoPercent} className="h-2 bg-white/10" />
          </div>

          {/* Seats */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Seats</span>
              <span className="text-slate-400">{seatCount ?? 0} / {data?.seat_limit}</span>
            </div>
            <Progress value={seatPercent} className="h-2 bg-white/10" />
          </div>
        </div>

        {resetDate && (
          <p className="text-xs text-slate-500">Quota resets on {resetDate}</p>
        )}
      </div>

      {/* Plan upgrade (owner only) */}
      {isOwner ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Plans</h2>
          <div className="grid grid-cols-3 gap-3">
            {PLANS.map(plan => {
              const isCurrent = plan.id === data?.plan_tier
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-4 space-y-3 ${plan.color} ${isCurrent ? 'bg-white/6' : 'bg-white/3'}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">{plan.name}</h3>
                    {isCurrent && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Current
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-bold text-white">{plan.price}</p>
                  <ul className="space-y-1 text-xs text-slate-400">
                    <li>{plan.seats} seats</li>
                    <li>{plan.images} images/mo</li>
                    <li>{plan.videos} videos/mo</li>
                  </ul>
                  {!isCurrent && plan.id !== 'starter' && (
                    <Button
                      size="sm"
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={!!upgrading}
                    >
                      {upgrading === plan.id ? 'Redirecting…' : (
                        <><Zap className="w-3 h-3 mr-1" /> Upgrade</>
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 bg-white/4 p-5 text-sm text-slate-400">
          Contact your org owner to change billing.
        </div>
      )}

      {/* Payment method / portal (owner only) */}
      {isOwner && data?.dodo_customer_id && (
        <div className="rounded-xl border border-white/8 bg-white/4 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Payment Method</h2>
          <p className="text-xs text-slate-400">Manage your payment details, download invoices, and update billing information.</p>
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/8"
            onClick={async () => {
              try {
                const { data: { session } } = await supabase.auth.getSession()
                const resp = await fetch(
                  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-customer-portal`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session?.access_token}`,
                    },
                  },
                )
                if (resp.ok) {
                  const { url } = await resp.json()
                  window.open(url, '_blank')
                }
              } catch {
                toast.error('Failed to open billing portal')
              }
            }}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Manage billing
          </Button>
        </div>
      )}
    </div>
  )
}

function BillingLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-32 bg-white/5" />
      <Skeleton className="h-48 w-full bg-white/5 rounded-xl" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 bg-white/5 rounded-xl" />)}
      </div>
    </div>
  )
}
