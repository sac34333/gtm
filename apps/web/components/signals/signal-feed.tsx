'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { type Tables } from '@/lib/supabase/types'
import { SignalCard } from '@/components/signals/signal-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { TrendingUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Signal = Tables<'signals'>

type DateRange = '7d' | '30d' | '90d' | 'all'

async function fetchSignals(orgId: string, showDismissed: boolean, dateRange: DateRange): Promise<Signal[]> {
  let query = supabase
    .from('signals')
    .select('*')
    .eq('org_id', orgId)
    .order('relevance_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (!showDismissed) {
    query = query.neq('status', 'dismissed').neq('status', 'archived')
  } else {
    query = query.neq('status', 'archived')
  }

  if (dateRange !== 'all') {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    // Filter on discovery time (when WE ingested) so freshly-fetched signals always show.
    query = query.gte('created_at', cutoff)
  }

  // Hard cap on article age — never show signals whose source content is older
  // than 180 days, even on "All time", to avoid evergreen HN threads from years ago.
  const HARD_AGE_CAP_DAYS = 180
  const ageCutoff = new Date(Date.now() - HARD_AGE_CAP_DAYS * 24 * 60 * 60 * 1000).toISOString()
  query = query.or(`published_at.gte.${ageCutoff},published_at.is.null`)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

const SOURCE_PILL_LABELS: Record<string, string> = {
  rss: 'News',
  hackernews: 'Hacker News',
  producthunt: 'Product Hunt',
  github: 'GitHub',
  youtube: 'YouTube',
  reddit: 'Reddit',
  newsapi: 'News',
  twitter: 'Twitter',
  gdelt: 'Global News',
  apify_linkedin: 'LinkedIn',
  tavily: 'AI Search',
  brave_search: 'Web Search',
  regional_auto: 'Regional News',
}

type RelevanceTier = 'high' | 'medium' | 'low'

function tierFor(score: number | null, publishedAt: string | null): RelevanceTier {
  if (score == null) return 'low'
  let ageDays = 0
  if (publishedAt) {
    const ms = new Date(publishedAt).getTime()
    if (Number.isFinite(ms)) ageDays = (Date.now() - ms) / (1000 * 60 * 60 * 24)
  }
  const isFresh = ageDays <= 30
  if (score >= 0.25 && isFresh) return 'high'
  if (score >= 0.1) return 'medium'
  return 'low'
}

const TIER_RANK: Record<RelevanceTier, number> = { high: 3, medium: 2, low: 1 }

export function SignalFeed({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient()
  const [showDismissed, setShowDismissed] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [relevanceFilter, setRelevanceFilter] = useState<'all' | RelevanceTier>('all')

  const { data: signals = [], isLoading, isFetching, isError, dataUpdatedAt } = useQuery({
    queryKey: ['signals', orgId, showDismissed, dateRange],
    queryFn: () => fetchSignals(orgId, showDismissed, dateRange),
    refetchInterval: 60 * 1000, // refresh every 60s
    staleTime: 30 * 1000,
  })

  // Reset client-side filters whenever the DB query changes so users can't get
  // stuck at 0 results with an invisible filter active.
  useEffect(() => {
    setSourceFilter('all')
    setRelevanceFilter('all')
  }, [dateRange, showDismissed])

  // "Last ingested" = newest created_at across the loaded rows.
  // This reflects when the cron job actually wrote new signals, not when the
  // browser last polled the DB (dataUpdatedAt would be misleading here).
  const lastIngestedAt = signals.reduce<number>((max, s) => {
    const t = s.created_at ? new Date(s.created_at).getTime() : 0
    return t > max ? t : max
  }, 0)
  const lastUpdatedLabel = lastIngestedAt
    ? formatDistanceToNow(new Date(lastIngestedAt), { addSuffix: true })
    : null
  // Suppress unused warning while keeping the import handy if you want to switch back
  void dataUpdatedAt

  const handleDismiss = useCallback((id: string) => {
    queryClient.setQueryData<Signal[]>(['signals', orgId, showDismissed, dateRange], (old = []) => {
      if (!showDismissed) return old.filter((s) => s.id !== id)
      return old.map((s) => s.id === id ? { ...s, status: 'dismissed' } : s)
    })
  }, [queryClient, orgId, showDismissed, dateRange])

  const handleRestore = useCallback((id: string) => {
    queryClient.setQueryData<Signal[]>(['signals', orgId, showDismissed, dateRange], (old = []) =>
      old.map((s) => s.id === id ? { ...s, status: 'unread', dismissed_at: null, dismissed_by: null } : s)
    )
  }, [queryClient, orgId, showDismissed, dateRange])

  // Derive distinct source types from loaded signals + per-source counts
  const sourceCounts = signals.reduce<Record<string, number>>((acc, s) => {
    if (!s.source_type) return acc
    acc[s.source_type] = (acc[s.source_type] ?? 0) + 1
    return acc
  }, {})
  const sourceTypes = Object.keys(sourceCounts).sort((a, b) => sourceCounts[b]! - sourceCounts[a]!)

  // Per-tier counts (after source filter applied, before relevance filter)
  const sourceFiltered = signals.filter((s) => sourceFilter === 'all' || s.source_type === sourceFilter)
  const tierCounts = sourceFiltered.reduce<Record<RelevanceTier, number>>(
    (acc, s) => { acc[tierFor(s.relevance_score, s.published_at ?? null)]++; return acc },
    { high: 0, medium: 0, low: 0 },
  )

  // Final filtered + sorted list: tier desc, then score desc, then created_at desc
  const filtered = sourceFiltered
    .filter((s) => relevanceFilter === 'all' || tierFor(s.relevance_score, s.published_at ?? null) === relevanceFilter)
    .sort((a, b) => {
      const ta = TIER_RANK[tierFor(a.relevance_score, a.published_at ?? null)]
      const tb = TIER_RANK[tierFor(b.relevance_score, b.published_at ?? null)]
      if (tb !== ta) return tb - ta
      const sa = a.relevance_score ?? 0
      const sb = b.relevance_score ?? 0
      if (sb !== sa) return sb - sa
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0
      return cb - ca
    })

  const dismissedCount = signals.filter((s) => s.status === 'dismissed').length

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-36 bg-slate-800 rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center space-y-3">
        <TrendingUp className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-red-300 font-medium">Failed to load signals</p>
        <p className="text-red-400/70 text-sm">Check your connection and try refreshing the page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range */}
        <div className="flex gap-1">
          {(['7d', '30d', '90d', 'all'] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                dateRange === r
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {r === 'all' ? 'All time' : r === '7d' ? '7 days' : r === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>

        {/* Show dismissed + live indicator */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${isFetching ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500/60'}`} />
            <span>Live</span>
            {lastUpdatedLabel && <span className="text-slate-600">· last fetched {lastUpdatedLabel}</span>}
          </div>
          {dismissedCount > 0 && (
            <div className="flex items-center gap-2">
              <Switch
                id="show-dismissed"
                checked={showDismissed}
                onCheckedChange={setShowDismissed}
              />
              <Label htmlFor="show-dismissed" className="text-slate-400 text-sm cursor-pointer">
                Show dismissed ({dismissedCount})
              </Label>
            </div>
          )}
        </div>
      </div>

      {/* Source pills with counts */}
      {sourceTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSourceFilter('all')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              sourceFilter === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
            }`}
          >
            All <span className="text-slate-500 ml-1">{signals.length}</span>
          </button>
          {sourceTypes.map((t) => (
            <button
              key={t}
              onClick={() => setSourceFilter(t)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                sourceFilter === t
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {SOURCE_PILL_LABELS[t] ?? t} <span className="text-slate-500 ml-1">{sourceCounts[t]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Relevance pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {([
          { key: 'all',    label: 'All',            count: sourceFiltered.length, dot: '' },
          { key: 'high',   label: 'High relevance', count: tierCounts.high,   dot: 'bg-emerald-400' },
          { key: 'medium', label: 'Medium',         count: tierCounts.medium, dot: 'bg-amber-400' },
          { key: 'low',    label: 'Low',            count: tierCounts.low,    dot: 'bg-slate-500' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setRelevanceFilter(t.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              relevanceFilter === t.key
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {t.dot && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />}
            {t.label} <span className="text-slate-500 ml-0.5">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Signal count */}
      {filtered.length > 0 && (
        <p className="text-slate-500 text-xs">{filtered.length} signal{filtered.length !== 1 ? 's' : ''}</p>
      )}

      {/* Empty states */}
      {filtered.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <TrendingUp className="h-6 w-6 text-slate-500" />
          </div>
          {signals.length === 0 ? (
            <>
              <p className="text-slate-300 font-medium">Your first signals will appear soon</p>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">
                We&apos;re scanning your configured sources. Signals should appear within 15 minutes.
              </p>
              <div className="flex gap-1 mt-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-300 font-medium">No signals match your filters</p>
              <p className="text-slate-500 text-sm mt-1">
                Try expanding the date range or clearing source filters.
              </p>
            </>
          )}
        </div>
      )}

      {/* Signal cards */}
      <div className="space-y-3 gtm-stagger">
        {filtered.map((signal) => (
          <SignalCard
            key={signal.id}
            signal={signal}
            isDismissed={signal.status === 'dismissed'}
            onDismiss={handleDismiss}
            onRestore={handleRestore}
          />
        ))}
      </div>
    </div>
  )
}
