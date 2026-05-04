'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, ArrowDown, ArrowUp, AlertCircle, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Prospect {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  job_title: string | null
  company_name: string | null
  industry: string | null
  country: string | null
  enrichment_source: string | null
  enrichment_data?: { source_url?: string | null } | null
  icp_score: number | null
  icp_fit_reason?: string | null
  status: string | null
  linkedin_url: string | null
  contacted_via?: 'campaign' | 'personal' | 'manual' | null
  last_contacted_at?: string | null
  last_campaign_id?: string | null
  last_campaign_name?: string | null
}

interface ProspectTableProps {
  prospects: Prospect[]
  jobId?: string
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function ContactedViaCaption({ via, at, campaignName }: { via?: string | null; at?: string | null; campaignName?: string | null }) {
  if (!via) return null
  const label =
    via === 'campaign' ? (campaignName ? `via ${campaignName}` : 'via campaign')
    : via === 'personal' ? 'via personalise'
    : 'manual'
  const tip = at ? `${label} · ${formatRelative(at)}` : label
  return (
    <span className="block mt-1 text-[10px] text-slate-500 truncate max-w-[140px]" title={tip}>
      {label}{at ? ` · ${formatRelative(at)}` : ''}
    </span>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge variant="secondary" className="bg-slate-800 text-slate-400 border-slate-700">N/A</Badge>
  if (score >= 0.7) return <Badge className="bg-emerald-900/30 border border-emerald-700/40 text-emerald-300">{Math.round(score * 100)}%</Badge>
  if (score >= 0.4) return <Badge className="bg-amber-900/30 border border-amber-700/40 text-amber-300">{Math.round(score * 100)}%</Badge>
  return <Badge variant="secondary" className="bg-slate-800 text-slate-400 border-slate-700">{Math.round(score * 100)}%</Badge>
}

function SourceBadge({ source }: { source: string | null }) {
  // Display labels — DB stores raw identifiers (web_search, pdl, ...).
  const labels: Record<string, string> = {
    web_search: 'AI search',
    pdl: 'PDL',
    apollo: 'Apollo',
    web_scrape: 'Web scrape',
    apify_linkedin: 'LinkedIn',
    hunter: 'Hunter',
    clearbit: 'Clearbit',
  }
  const colors: Record<string, string> = {
    web_search: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300',
    pdl: 'bg-violet-900/30 border-violet-700/40 text-violet-300',
    apollo: 'bg-blue-900/30 border-blue-700/40 text-blue-300',
    web_scrape: 'bg-slate-800 border-slate-700 text-slate-400',
    apify_linkedin: 'bg-sky-900/30 border-sky-700/40 text-sky-300',
    hunter: 'bg-orange-900/30 border-orange-700/40 text-orange-300',
    clearbit: 'bg-rose-900/30 border-rose-700/40 text-rose-300',
  }
  const key = source ?? 'manual'
  const label = labels[key] ?? key
  const colorClass = colors[key] ?? 'bg-slate-800 border-slate-700 text-slate-400'
  return <Badge className={`${colorClass} border`}>{label}</Badge>
}

type SortKey = 'icp_score' | 'company_name' | 'country'
type SortDir = 'asc' | 'desc'

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', cls: 'bg-slate-800 border-slate-700 text-slate-400' },
  { value: 'contacted', label: 'Contacted', cls: 'bg-indigo-900/30 border-indigo-700/40 text-indigo-300' },
  { value: 'replied', label: 'Replied', cls: 'bg-amber-900/30 border-amber-700/40 text-amber-300' },
  { value: 'qualified', label: 'Qualified', cls: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' },
  { value: 'disqualified', label: 'Disqualified', cls: 'bg-rose-900/30 border-rose-700/40 text-rose-300' },
] as const

function StatusSelect({ prospectId, value }: { prospectId: string; value: string | null }) {
  const [current, setCurrent] = useState(value ?? 'new')
  const [saving, setSaving] = useState(false)
  const supabase = getSupabaseBrowserClient()

  const opt = STATUS_OPTIONS.find(o => o.value === current) ?? STATUS_OPTIONS[0]

  async function handleChange(next: string) {
    const prev = current
    setCurrent(next)
    setSaving(true)
    // Manual lifecycle change → record attribution so the ICP list can show
    // "via Manual" rather than the prior 'campaign'/'personal' tag.
    // Only stamp contacted_via='manual' when the user is actively flipping the
    // status to 'contacted' (or any later stage). Going back to 'new' clears it.
    const patch: Record<string, any> = { status: next }
    if (next === 'new') {
      patch.contacted_via = null
      patch.last_contacted_at = null
    } else if (next === 'contacted' || next === 'replied' || next === 'qualified' || next === 'disqualified') {
      patch.contacted_via = 'manual'
      patch.last_contacted_at = new Date().toISOString()
    }
    const { error } = await supabase.from('prospects').update(patch).eq('id', prospectId)
    setSaving(false)
    if (error) {
      setCurrent(prev)
      toast.error('Failed to update status')
    } else {
      toast.success(`Marked as ${STATUS_OPTIONS.find(o => o.value === next)?.label ?? next}`)
    }
  }

  return (
    <select
      value={current}
      onChange={e => handleChange(e.target.value)}
      disabled={saving}
      className={`text-xs px-2 py-1 rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 ${opt.cls} disabled:opacity-50`}
    >
      {STATUS_OPTIONS.map(o => (
        <option key={o.value} value={o.value} className="bg-slate-900 text-slate-200">{o.label}</option>
      ))}
    </select>
  )
}

export function ProspectTable({ prospects, jobId }: ProspectTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'icp_score', dir: 'desc' })

  const sorted = useMemo(() => {
    return [...prospects].sort((a, b) => {
      const av = a[sort.key] ?? ''
      const bv = b[sort.key] ?? ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [prospects, sort])

  const toggleSort = (key: SortKey) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'desc' })
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sort.key !== col) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
    return sort.dir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
  }

  if (prospects.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p className="text-sm">No prospects yet. Run enrichment to populate this list.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/60">
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Title</th>
            <th className="text-left px-4 py-3">
              <button onClick={() => toggleSort('company_name')} className="flex items-center gap-1 text-slate-400 font-medium hover:text-slate-200">
                Company <SortIcon col="company_name" />
              </button>
            </th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Industry</th>
            <th className="text-left px-4 py-3">
              <button onClick={() => toggleSort('country')} className="flex items-center gap-1 text-slate-400 font-medium hover:text-slate-200">
                Country <SortIcon col="country" />
              </button>
            </th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Source</th>
            <th className="text-left px-4 py-3">
              <button onClick={() => toggleSort('icp_score')} className="flex items-center gap-1 text-slate-400 font-medium hover:text-slate-200">
                ICP Score <SortIcon col="icp_score" />
              </button>
            </th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="gtm-stagger">
          {sorted.map((p) => {
            // Email is intentionally not part of web-search enrichment, so don't warn about it.
            const missingFields = [
              !p.company_name && 'company',
              !p.job_title && 'title',
            ].filter(Boolean) as string[]

            return (
              <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {/* Gradient avatar circle */}
                    {(() => {
                      const initials = ([p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join('') || (p.company_name?.[0] ?? '?')).toUpperCase()
                      // Pick a deterministic gradient from the prospect id
                      const gradients = [
                        'from-indigo-500 to-fuchsia-500',
                        'from-sky-500 to-cyan-400',
                        'from-emerald-500 to-teal-400',
                        'from-amber-500 to-rose-500',
                        'from-violet-500 to-pink-500',
                        'from-blue-500 to-indigo-500',
                      ]
                      const idx = (p.id ? p.id.charCodeAt(0) + p.id.charCodeAt(1) : 0) % gradients.length
                      return (
                        <div className={`shrink-0 h-8 w-8 rounded-full bg-gradient-to-br ${gradients[idx]} flex items-center justify-center text-[11px] font-semibold text-white shadow-sm ring-1 ring-white/10`}>
                          {initials}
                        </div>
                      )
                    })()}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                    <span className="text-slate-100 font-medium">
                      {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'}
                    </span>
                    {p.linkedin_url ? (
                      <a
                        href={p.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open LinkedIn profile"
                        className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        LinkedIn <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : p.enrichment_data?.source_url ? (
                      <a
                        href={p.enrichment_data.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={p.enrichment_data.source_url}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        Source <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-600">no link</span>
                    )}
                    {missingFields.length > 0 && (
                      <span title={`Missing: ${missingFields.join(', ')}`}>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      </span>
                    )}
                  </div>
                  {p.email && <div className="text-xs text-slate-500 mt-0.5">{p.email}</div>}
                  {p.icp_fit_reason && (
                    <div className="text-xs text-slate-500 mt-1 max-w-md leading-snug italic">
                      “{p.icp_fit_reason}”
                    </div>
                  )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-300">{p.job_title ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300">{p.company_name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{p.industry ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{p.country ?? '—'}</td>
                <td className="px-4 py-3"><SourceBadge source={p.enrichment_source} /></td>
                <td className="px-4 py-3"><ScoreBadge score={p.icp_score} /></td>
                <td className="px-4 py-3">
                  <StatusSelect prospectId={p.id} value={p.status} />
                  {p.status && p.status !== 'new' && (
                    <ContactedViaCaption via={p.contacted_via} at={p.last_contacted_at} campaignName={p.last_campaign_name} />
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/icp/${p.id}/personalise${jobId ? `?job_id=${jobId}` : ''}`}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap"
                  >
                    Personalise →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
