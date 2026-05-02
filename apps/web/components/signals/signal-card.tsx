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

function relevanceBadgeClass(score: number) {
  if (score >= 0.7) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (score >= 0.4) return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  return 'bg-slate-500/15 text-slate-400 border-slate-500/30'
}

const SOURCE_LABELS: Record<string, string> = {
  rss: 'RSS',
  hackernews: 'HN',
  producthunt: 'PH',
  github: 'GitHub',
  youtube: 'YouTube',
  reddit: 'Reddit',
  newsapi: 'NewsAPI',
  twitter: 'Twitter',
  gdelt: 'GDELT',
  apify_linkedin: 'LinkedIn',
  tavily: 'Tavily',
  brave_search: 'Brave',
  regional_auto: 'Regional',
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
    <Card className={`bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors ${isDismissed ? 'opacity-60' : ''}`}>
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
            {signal.relevance_score != null && (
              <Badge className={`text-xs tabular-nums border ${relevanceBadgeClass(signal.relevance_score)}`}>
                {Math.round(signal.relevance_score * 100)}%
              </Badge>
            )}
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
              <Button
                size="sm"
                asChild
                className="bg-indigo-600 hover:bg-indigo-500 h-7 text-xs"
              >
                <Link href={`/create?signal_id=${signal.id}`}>
                  <Zap className="h-3 w-3 mr-1" />
                  Use this trend
                </Link>
              </Button>
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
