import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ArrowLeft, ExternalLink, Clock, Tag, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const relevanceBadge = (score: number) =>
  score >= 0.7
    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
    : score >= 0.4
    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
    : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'

export default async function SignalDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.org_id
  if (!orgId) redirect('/create-org')

  const { data: signal } = await supabase
    .from('signals')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .single()

  if (!signal) notFound()

  const publishedAt = signal.published_at ? new Date(signal.published_at) : null
  const timeAgo = publishedAt
    ? (() => {
        const diff = Date.now() - publishedAt.getTime()
        const h = Math.floor(diff / 3_600_000)
        if (h < 24) return `${h}h ago`
        return `${Math.floor(h / 24)}d ago`
      })()
    : null

  const themes: string[] = Array.isArray(signal.matched_themes) ? (signal.matched_themes as string[]) : []

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Back */}
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Trend Intelligence
        </Link>

        {/* Header card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-semibold text-slate-100 leading-tight">{signal.headline}</h1>
            {typeof signal.relevance_score === 'number' && (
              <span className={`shrink-0 text-sm font-semibold px-2.5 py-1 rounded-full ${relevanceBadge(signal.relevance_score)}`}>
                {(signal.relevance_score * 100).toFixed(0)}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="capitalize">{signal.source_type?.replace(/_/g, ' ')}</span>
            {timeAgo && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />{timeAgo}
              </span>
            )}
            {signal.url && (
              <a href={signal.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
                View original <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Matched themes */}
          {themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
              {themes.map((t, i) => (
                <span key={i} className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded text-xs">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {signal.summary && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Summary</h2>
            <p className="text-slate-300 leading-relaxed">{signal.summary}</p>
          </div>
        )}

        {/* Full content from raw_payload */}
        {(() => {
          const payload = signal.raw_payload
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
          const content = (payload as Record<string, unknown>).content
          if (!content || typeof content !== 'string') return null
          return (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-2">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Full Article</h2>
              <div className="text-slate-400 text-sm leading-relaxed whitespace-pre-line">{content}</div>
            </div>
          )
        })()}

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link href={`/create?signal_id=${signal.id}`}>
            <Button className="bg-indigo-600 hover:bg-indigo-500">
              <Zap className="w-4 h-4 mr-2" />
              Use this trend
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Back to feed
            </Button>
          </Link>
        </div>

      </div>
    </div>
  )
}
