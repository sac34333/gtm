'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, ArrowDown, ArrowUp, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

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
  icp_score: number | null
  status: string | null
  linkedin_url: string | null
}

interface ProspectTableProps {
  prospects: Prospect[]
  jobId?: string
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge variant="secondary" className="bg-slate-800 text-slate-400 border-slate-700">N/A</Badge>
  if (score >= 0.7) return <Badge className="bg-emerald-900/30 border border-emerald-700/40 text-emerald-300">{Math.round(score * 100)}%</Badge>
  if (score >= 0.4) return <Badge className="bg-amber-900/30 border border-amber-700/40 text-amber-300">{Math.round(score * 100)}%</Badge>
  return <Badge variant="secondary" className="bg-slate-800 text-slate-400 border-slate-700">{Math.round(score * 100)}%</Badge>
}

function SourceBadge({ source }: { source: string | null }) {
  const colors: Record<string, string> = {
    pdl: 'bg-violet-900/30 border-violet-700/40 text-violet-300',
    apollo: 'bg-blue-900/30 border-blue-700/40 text-blue-300',
    web_scrape: 'bg-slate-800 border-slate-700 text-slate-400',
    apify_linkedin: 'bg-sky-900/30 border-sky-700/40 text-sky-300',
    hunter: 'bg-orange-900/30 border-orange-700/40 text-orange-300',
    clearbit: 'bg-rose-900/30 border-rose-700/40 text-rose-300',
  }
  const label = source ?? 'manual'
  const colorClass = colors[label] ?? 'bg-slate-800 border-slate-700 text-slate-400'
  return <Badge className={`${colorClass} border`}>{label}</Badge>
}

type SortKey = 'icp_score' | 'company_name' | 'country'
type SortDir = 'asc' | 'desc'

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
        <tbody>
          {sorted.map((p) => {
            const missingFields = [
              !p.email && 'email',
              !p.company_name && 'company',
              !p.job_title && 'title',
            ].filter(Boolean) as string[]

            return (
              <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-100 font-medium">
                      {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'}
                    </span>
                    {missingFields.length > 0 && (
                      <span title={`Missing: ${missingFields.join(', ')}`}>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      </span>
                    )}
                  </div>
                  {p.email && <div className="text-xs text-slate-500 mt-0.5">{p.email}</div>}
                </td>
                <td className="px-4 py-3 text-slate-300">{p.job_title ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300">{p.company_name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{p.industry ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{p.country ?? '—'}</td>
                <td className="px-4 py-3"><SourceBadge source={p.enrichment_source} /></td>
                <td className="px-4 py-3"><ScoreBadge score={p.icp_score} /></td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="bg-slate-800 border-slate-700 text-slate-400 capitalize text-xs">
                    {p.status ?? 'new'}
                  </Badge>
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
