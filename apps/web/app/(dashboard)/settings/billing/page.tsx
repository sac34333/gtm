'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle2, CreditCard, Zap, ImageIcon, Video, Users } from 'lucide-react'
import { format } from 'date-fns'

// ─── Plan definitions ─────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free trial',
    seats: 2,
    images: 5,
    videos: 2,
    description: 'Try the product. Limited quotas.',
    badge: 'bg-slate-700 text-slate-200 border-slate-600',
    accent: 'border-slate-700',
  },
  {
    id: 'byok',
    name: 'Bring Your Own Keys',
    price: '$29/mo',
    seats: 5,
    images: 'Use your keys',
    videos: 'Use your keys',
    description: 'You pay providers directly. We handle ingestion + UI.',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    accent: 'border-amber-500/40',
  },
  {
    id: 'fully_subscribed',
    name: 'Fully Subscribed',
    price: '$249/mo',
    seats: 10,
    images: 300,
    videos: 30,
    description: 'We cover all AI costs. Switch any model. BYOK optional.',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    accent: 'border-indigo-500/40',
  },
]

const DODO_PRODUCT_IDS: Record<string, string> = {
  byok: process.env.NEXT_PUBLIC_DODO_PRODUCT_BYOK ?? '',
  fully_subscribed: process.env.NEXT_PUBLIC_DODO_PRODUCT_FULLY_SUBSCRIBED ?? '',
}

async function createCheckoutSession(planId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const orgId = (session?.user.app_metadata as { org_id?: string })?.org_id
  const { data: orgData } = await supabase
    .from('orgs')
    .select('dodo_customer_id')
    .eq('id', orgId)
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

interface OrgBillingData {
  id: string
  plan_tier: string
  seat_limit: number
  image_quota: number
  video_quota: number
  image_used: number
  video_used: number
  quota_reset_at: string | null
  dodo_customer_id: string | null
}

async function fetchOrgBilling(): Promise<{ org: OrgBillingData; role: string; seatCount: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not_authenticated')
  const orgId = (user.app_metadata as { org_id?: string })?.org_id
  if (!orgId) throw new Error('no_org')

  const [{ data: org, error }, { data: member }, { count }] = await Promise.all([
    supabase
      .from('orgs')
      .select('id, plan_tier, seat_limit, image_quota, video_quota, image_used, video_used, quota_reset_at, dodo_customer_id')
      .eq('id', orgId)
      .single(),
    supabase.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).single(),
    supabase.from('org_members').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
  ])

  if (error || !org) throw new Error('Failed to load billing data')

  return {
    org: org as OrgBillingData,
    role: member?.role ?? 'member',
    seatCount: count ?? 0,
  }
}

export default function SettingsBillingPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['org-billing'],
    queryFn: fetchOrgBilling,
    staleTime: 30_000,
  })

  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)

  async function handleUpgrade(planId: string) {
    setUpgrading(planId)
    try {
      const url = await createCheckoutSession(planId)
      window.location.href = url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start checkout')
    } finally {
      setUpgrading(null)
    }
  }

  async function handleOpenPortal() {
    setOpeningPortal(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-customer-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      })
      if (!resp.ok) throw new Error('portal_failed')
      const { url } = await resp.json()
      window.open(url, '_blank')
    } catch {
      toast.error('Failed to open billing portal')
    } finally {
      setOpeningPortal(false)
    }
  }

  if (isLoading) return <BillingLoading />
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-100">Billing</h1>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-red-300">Failed to load billing data.</p>
          <Button variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800" onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    )
  }

  const { org, role, seatCount } = data
  const isOwner = role === 'owner'
  const isUnlimited = org.image_quota >= 999_999
  const imagePercent = isUnlimited ? 0 : Math.min(100, (org.image_used / Math.max(org.image_quota, 1)) * 100)
  const videoPercent = Math.min(100, (org.video_used / Math.max(org.video_quota, 1)) * 100)
  const seatPercent = Math.min(100, (seatCount / Math.max(org.seat_limit, 1)) * 100)
  const currentPlan = PLANS.find(p => p.id === org.plan_tier) ?? PLANS[0]
  const resetDate = org.quota_reset_at ? format(new Date(org.quota_reset_at), 'MMM d, yyyy') : null

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Billing</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your plan and usage quotas.</p>
      </div>

      {/* Current plan + usage */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Current plan</p>
            <h2 className="text-lg font-semibold text-slate-100 mt-0.5">{currentPlan.name}</h2>
            <p className="text-xs text-slate-400 mt-1">{currentPlan.description}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-md border font-medium whitespace-nowrap ${currentPlan.badge}`}>
            {currentPlan.price}
          </span>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 pt-2">
          <UsageMeter icon={ImageIcon} label="Images" used={org.image_used} limit={isUnlimited ? null : org.image_quota} percent={imagePercent} />
          <UsageMeter icon={Video} label="Videos" used={org.video_used} limit={org.video_quota} percent={videoPercent} />
          <UsageMeter icon={Users} label="Seats" used={seatCount} limit={org.seat_limit} percent={seatPercent} />
        </div>

        {resetDate && (
          <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">Quotas reset on {resetDate}</p>
        )}
      </div>

      {/* Plans */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Available plans</h2>
        {!isOwner && (
          <p className="text-xs text-slate-500">Only the org owner can change the plan.</p>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          {PLANS.map(plan => {
            const isCurrent = plan.id === org.plan_tier
            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-4 space-y-3 bg-slate-900 ${isCurrent ? plan.accent : 'border-slate-800'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-100 text-sm">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-[10px] text-emerald-300 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Current
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-slate-100">{plan.price}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed min-h-[2.5rem]">{plan.description}</p>
                <ul className="space-y-1 text-xs text-slate-400 pt-1 border-t border-slate-800">
                  <li>{plan.seats} seats</li>
                  <li>{typeof plan.images === 'number' ? `${plan.images} images/mo` : plan.images}</li>
                  <li>{typeof plan.videos === 'number' ? `${plan.videos} videos/mo` : plan.videos}</li>
                </ul>
                {isOwner && !isCurrent && plan.id !== 'starter' && (
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
      </section>

      {/* Payment portal */}
      {isOwner && org.dodo_customer_id && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Payment & invoices</h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage your payment details, download invoices, and update billing information.</p>
          </div>
          <Button
            variant="outline"
            className="border-slate-700 text-slate-100 hover:bg-slate-800"
            onClick={handleOpenPortal}
            disabled={openingPortal}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {openingPortal ? 'Opening…' : 'Manage billing'}
          </Button>
        </section>
      )}
    </div>
  )
}

function UsageMeter({ icon: Icon, label, used, limit, percent }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  used: number
  limit: number | null
  percent: number
}) {
  const isNearLimit = percent >= 80
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-400">
          <Icon className="w-3.5 h-3.5" /> {label}
        </span>
        <span className={isNearLimit ? 'text-amber-300 font-medium' : 'text-slate-300'}>
          {used} / {limit === null ? '∞' : limit}
        </span>
      </div>
      <Progress value={limit === null ? 0 : percent} className="h-1.5 bg-slate-800" />
    </div>
  )
}

function BillingLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <Skeleton className="h-8 w-32 bg-slate-800" />
      <Skeleton className="h-48 w-full bg-slate-800 rounded-xl" />
      <div className="grid sm:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 bg-slate-800 rounded-xl" />)}
      </div>
    </div>
  )
}
