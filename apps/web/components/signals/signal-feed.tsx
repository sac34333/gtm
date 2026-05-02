'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { type Tables } from '@/lib/supabase/types'
import { SignalCard } from '@/components/signals/signal-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Loader2 } from 'lucide-react'

type Signal = Tables<'signals'>

type DateRange = '7d' | '30d' | '90d' | 'all'

async function fetchSignals(orgId: string, showDismissed: boolean, dateRange: DateRange): Promise<Signal[]> {
  let query = supabase
    .from('signals')
    .select('*')
    .eq('org_id', orgId)
    .order('relevance_score', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(100)

  if (!showDismissed) {
    query = query.neq('status', 'dismissed').neq('status', 'archived')
  } else {
    query = query.neq('status', 'archived')
  }

  if (dateRange !== 'all') {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('published_at', cutoff)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export function SignalFeed({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient()
  const [showDismissed, setShowDismissed] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  const { data: signals = [], isLoading, isFetching } = useQuery({
    queryKey: ['signals', orgId, showDismissed, dateRange],
    queryFn: () => fetchSignals(orgId, showDismissed, dateRange),
    refetchInterval: 60 * 1000, // refresh every 60s
    staleTime: 30 * 1000,
  })

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

  // Derive distinct source types from loaded signals
  const sourceTypes = Array.from(new Set(signals.map((s) => s.source_type).filter(Boolean))) as string[]

  const filtered = signals.filter((s) => {
    if (sourceFilter !== 'all' && s.source_type !== sourceFilter) return false
    return true
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

        {/* Source type filter */}
        {sourceTypes.length > 1 && (
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-md px-2 py-1"
          >
            <option value="all">All sources</option>
            {sourceTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* Show dismissed */}
        <div className="flex items-center gap-2 ml-auto">
          {isFetching && !isLoading && (
            <Loader2 className="h-3 w-3 text-slate-500 animate-spin" />
          )}
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
      <div className="space-y-3">
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
