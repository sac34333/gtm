'use client'

import Link from 'next/link'
import { useState } from 'react'
import { type Tables } from '@/lib/supabase/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, Zap, X, RotateCcw, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

type Signal = Tables<'signals'>

function relevanceBadge(score: number, publishedAt: string | null): { label: string; className: string } {
  // Age-aware: an article older than 30 days can never be "High relevance",
  // even if its keyword score is strong. Keeps the feed feeling fresh.
  let ageDays = 0
  if (publishedAt) {
    const ms = new Date(publishedAt).getTime()
    if (Number.isFinite(ms)) ageDays = (Date.now() - ms) / (1000 * 60 * 60 * 24)
  }
  const isFresh = ageDays <= 30

  if (score >= 0.25 && isFresh) return { label: 'High relevance', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
  if (score >= 0.1) return { label: 'Medium', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
  return { label: 'Low', className: 'bg-slate-500/15 text-slate-400 border-slate-500/30' }
}

const SOURCE_LABELS: Record<string, string> = {
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

interface SignalCardProps {
  signal: Signal
  onDismiss?: (id: string) => void
  onRestore?: (id: string) => void
  isDismissed?: boolean
}

export function SignalCard({ signal, onDismiss, onRestore, isDismissed }: SignalCardProps) {
  const [isActing, setIsActing] = useState(false)

  async function handleDismiss() {
    setIsActing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('signals')
        .update({ status: 'dismissed', dismissed_at: new Date().toISOString(), dismissed_by: user?.id })
        .eq('id', signal.id)
      if (error) throw error
      onDismiss?.(signal.id)
    } catch {
      toast.error('Failed to dismiss signal')
    } finally {
      setIsActing(false)
    }
  }

  async function handleRestore() {
    setIsActing(true)
    try {
      const { error } = await supabase
        .from('signals')
        .update({ status: 'unread', dismissed_at: null, dismissed_by: null })
        .eq('id', signal.id)
      if (error) throw error
      onRestore?.(signal.id)
    } catch {
      toast.error('Failed to restore signal')
    } finally {
      setIsActing(false)
    }
  }

  return (
    <Card className={`bg-slate-900 border-slate-800 hover:border-slate-700 hover:-translate-y-0.5 hover:shadow-glow-indigo transition-all duration-300 ${isDismissed ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <a
              href={signal.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-100 font-medium leading-snug hover:text-indigo-400 transition-colors line-clamp-2 group"
            >
              {signal.headline ?? 'Untitled signal'}
              <ExternalLink className="inline h-3 w-3 ml-1 opacity-0 group-hover:opacity-100" />
            </a>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {signal.source_type && (
                <Badge variant="outline" className="text-xs border-slate-700 text-slate-400 px-1.5 py-0">
                  {SOURCE_LABELS[signal.source_type] ?? signal.source_type}
                </Badge>
              )}
              {signal.source_name && (
                <span className="text-slate-500 text-xs">{signal.source_name}</span>
              )}
              {signal.published_at && (
                <span className="text-slate-600 text-xs">
                  · {formatDistanceToNow(new Date(signal.published_at), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {signal.relevance_score != null && (() => {
              const { label, className } = relevanceBadge(signal.relevance_score, signal.published_at ?? null)
              return <Badge className={`text-xs border ${className}`}>{label}</Badge>
            })()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {signal.summary && (
          <p className="text-slate-400 text-sm line-clamp-2">{signal.summary}</p>
        )}

        {/* Theme chips */}
        {Array.isArray(signal.matched_themes) && signal.matched_themes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(signal.matched_themes as string[]).map((theme) => (
              <span
                key={theme}
                className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              >
                {theme}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {isDismissed ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestore}
              disabled={isActing}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-7 text-xs"
            >
              {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RotateCcw className="h-3 w-3 mr-1" />Restore</>}
            </Button>
          ) : (
            <>
              <Link
                href={`/create?signal_id=${signal.id}`}
                className="inline-flex items-center h-7 px-2.5 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                <Zap className="h-3 w-3 mr-1" />
                Use this trend
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                disabled={isActing}
                className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 h-7 text-xs"
              >
                {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><X className="h-3 w-3 mr-1" />Dismiss</>}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
