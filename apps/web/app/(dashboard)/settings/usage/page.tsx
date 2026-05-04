'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useOrgStore } from '@/store/org.store'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Info } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UsageRow {
  provider_key: string
  model_id: string
  step_key: string | null
  key_source_used: string | null
  total_calls: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_usd: number
}

interface UsageData {
  period: string
  by_model: UsageRow[]
  totals: {
    total_calls: number
    total_tokens: number
    estimated_cost_usd: number
  }
  key_source_split: {
    platform: { calls: number; cost_usd: number }
    user: { calls: number; cost_usd: number }
  }
}

type Period = 'day' | 'week' | 'month' | 'all'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchUsageStats(period: Period): Promise<UsageData> {
  const { data: { session } } = await supabase.auth.getSession()
  const resp = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-usage-stats?period=${period}`,
    {
      headers: { 'Authorization': `Bearer ${session?.access_token}` },
    },
  )
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'request_failed' }))
    throw new Error(err.error ?? 'request_failed')
  }
  return resp.json()
}

function formatCost(n: number) {
  if (n === 0) return '$0.00'
  if (n < 0.0001) return `< $0.0001`
  return `$${n.toFixed(4)}`
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsUsagePage() {
  const { userRole } = useOrgStore()
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('month')
  const isMember = userRole === 'member'

  const { data, isLoading, isError, refetch } = useQuery<UsageData>({
    queryKey: ['usage-stats', period],
    queryFn: () => fetchUsageStats(period),
    staleTime: 60_000,
    retry: 1,
    enabled: !isMember,
  })

  // Redirect members (after hooks)
  useEffect(() => {
    if (isMember) {
      toast.error('Upgrade required')
      router.push('/dashboard')
    }
  }, [isMember, router])

  if (isMember) return null

  const PERIOD_TABS: { label: string; value: Period }[] = [
    { label: 'Today', value: 'day' },
    { label: 'Last 7 days', value: 'week' },
    { label: 'Last 30 days', value: 'month' },
    { label: 'All time', value: 'all' },
  ]

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold gtm-title tracking-tight">AI Usage</h1>
        <p className="text-slate-400 text-sm mt-1">Track AI model calls and estimated costs.</p>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1 p-1 bg-slate-800 rounded-lg w-fit">
        {PERIOD_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setPeriod(tab.value)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              period === tab.value
                ? 'bg-indigo-600 text-slate-100 font-medium'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <UsageLoading />
      ) : isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-red-300">Failed to load usage data.</p>
          <Button variant="outline" className="border-slate-700 text-slate-100" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : !data || data.by_model.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center space-y-3">
          <p className="text-slate-300 font-medium">No AI usage recorded yet.</p>
          <p className="text-slate-500 text-sm">Generate a trend image or run an outreach copy step to see usage here.</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-1">
              <p className="text-xs text-slate-400 font-medium">Platform calls</p>
              <p className="text-2xl font-bold text-slate-100">
                {formatNumber(data.key_source_split.platform.calls)}
              </p>
              <p className="text-xs text-slate-500">
                {formatCost(data.key_source_split.platform.cost_usd)} est. cost
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-1">
              <p className="text-xs text-slate-400 font-medium">Your API key calls</p>
              <p className="text-2xl font-bold text-slate-100">
                {formatNumber(data.key_source_split.user.calls)}
              </p>
              <p className="text-xs text-slate-500">
                {formatCost(data.key_source_split.user.cost_usd)} billed to your accounts
              </p>
            </div>
          </div>

          {/* Usage table */}
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 font-medium">Provider</TableHead>
                  <TableHead className="text-slate-400 font-medium">Model</TableHead>
                  <TableHead className="text-slate-400 font-medium">Step</TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">Calls</TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">Input Tokens</TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">Output Tokens</TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">Est. Cost (USD)</TableHead>
                  <TableHead className="text-slate-400 font-medium">Key Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_model.map((row, i) => (
                  <TableRow key={i} className="border-slate-800 hover:bg-slate-900">
                    <TableCell className="text-slate-300 font-mono text-xs">{row.provider_key}</TableCell>
                    <TableCell className="text-slate-300 text-xs max-w-[180px] truncate">{row.model_id}</TableCell>
                    <TableCell className="text-slate-400 text-xs">{row.step_key ?? '—'}</TableCell>
                    <TableCell className="text-slate-100 text-right">{formatNumber(row.total_calls)}</TableCell>
                    <TableCell className="text-slate-300 text-right text-xs">{formatNumber(row.prompt_tokens)}</TableCell>
                    <TableCell className="text-slate-300 text-right text-xs">{formatNumber(row.completion_tokens)}</TableCell>
                    <TableCell className="text-slate-100 text-right text-xs font-mono">{formatCost(row.estimated_cost_usd)}</TableCell>
                    <TableCell>
                      {row.key_source_used === 'platform' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Platform</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">Your key</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Totals row */}
                <TableRow className="border-slate-800 bg-slate-900 font-semibold">
                  <TableCell colSpan={3} className="text-slate-300">Total</TableCell>
                  <TableCell className="text-slate-100 text-right">{formatNumber(data.totals.total_calls)}</TableCell>
                  <TableCell colSpan={2} className="text-slate-300 text-right text-xs">
                    {formatNumber(data.totals.total_tokens)} total
                  </TableCell>
                  <TableCell className="text-slate-100 text-right text-xs font-mono">
                    {formatCost(data.totals.estimated_cost_usd)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-900 rounded-lg px-4 py-3">
            <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>
              Cost estimates are calculated from model pricing data in the GTM Engine catalog and are for reference only.
              Actual charges depend on your provider billing. Platform key calls are billed to the GTM Engine platform
              account. Your API key calls are billed directly to your own provider accounts.
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function UsageLoading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24 bg-slate-800 rounded-xl" />
        <Skeleton className="h-24 bg-slate-800 rounded-xl" />
      </div>
      <Skeleton className="h-64 bg-slate-800 rounded-xl" />
    </div>
  )
}
