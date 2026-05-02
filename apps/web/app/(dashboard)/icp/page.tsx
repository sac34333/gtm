'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { INDUSTRIES, ICP_COMPANY_SIZES, COUNTRIES } from '@/lib/constants'
import { MultiSelect } from '@/components/icp/multi-select'
import { TagInput } from '@/components/icp/tag-input'
import { ProspectTable } from '@/components/icp/prospect-table'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, Zap, Download } from 'lucide-react'

interface ICPCriteria {
  industries: string[]
  company_sizes: string[]
  geographies: string[]
  titles: string[]
  keywords: string[]
  domains: string[]
}

const EMPTY_CRITERIA: ICPCriteria = {
  industries: [],
  company_sizes: [],
  geographies: [],
  titles: [],
  keywords: [],
  domains: [],
}

function criteriaEqual(a: ICPCriteria, b: ICPCriteria): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export default function ICPPage() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job_id') ?? undefined

  const supabase = getSupabaseBrowserClient()

  const [criteria, setCriteria] = useState<ICPCriteria>(EMPTY_CRITERIA)
  const [savedCriteria, setSavedCriteria] = useState<ICPCriteria>(EMPTY_CRITERIA)
  const [prospects, setProspects] = useState<any[]>([])
  const [loadingProspects, setLoadingProspects] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [rescoring, setRescoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enrichResult, setEnrichResult] = useState<{ total: number; sources: string[] } | null>(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    let active = true
    cancelRef.current = false

    async function load() {
      setLoadingProspects(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || !active) return

        const { data: brand } = await supabase
          .from('brand_contexts')
          .select('last_icp_criteria')
          .single()

        if (brand?.last_icp_criteria && active) {
          const saved = brand.last_icp_criteria as unknown as ICPCriteria
          setSavedCriteria(saved)
          setCriteria(saved)
        }

        const { data: rows } = await supabase
          .from('prospects')
          .select('id,first_name,last_name,email,job_title,company_name,industry,country,enrichment_source,icp_score,status,linkedin_url')
          .order('icp_score', { ascending: false })

        if (rows && active) setProspects(rows)
      } catch {
        // silent
      } finally {
        if (active) setLoadingProspects(false)
      }
    }

    load()
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const callEnrich = useCallback(async (rescoreOnly = false) => {
    setError(null)
    if (rescoreOnly) setRescoring(true)
    else setEnriching(true)
    setEnrichResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/icp-enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ criteria, rescore_only: rescoreOnly }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const json = await res.json()
      setProspects(json.prospects ?? [])
      setSavedCriteria(criteria)
      setEnrichResult({ total: json.total ?? 0, sources: json.enrichment_sources_used ?? [] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnriching(false)
      setRescoring(false)
    }
  }, [criteria, supabase])

  const handleCsvExport = () => {
    const header = 'Name,Title,Company,Industry,Country,Source,ICP Score,Status,Email'
    const rows = prospects.map(p => [
      `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
      p.job_title ?? '',
      p.company_name ?? '',
      p.industry ?? '',
      p.country ?? '',
      p.enrichment_source ?? '',
      p.icp_score != null ? Math.round(p.icp_score * 100) + '%' : '',
      p.status ?? '',
      p.email ?? '',
    ].map(v => `"${v}"`).join(','))
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'prospects.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const isDirty = !criteriaEqual(criteria, savedCriteria)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-screen-xl mx-auto px-6 py-10 space-y-8">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">ICP & Prospects</h1>
            <p className="text-slate-400 text-sm mt-1">Define your ideal customer profile and enrich prospect data.</p>
          </div>
          <div className="flex items-center gap-2">
            {prospects.length > 0 && (
              <button
                onClick={handleCsvExport}
                className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
          <h2 className="text-base font-semibold text-slate-100">ICP Criteria</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Industries</label>
              <MultiSelect
                options={INDUSTRIES}
                selected={criteria.industries}
                onChange={v => setCriteria(prev => ({ ...prev, industries: v }))}
                placeholder="Any industry"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Company Size</label>
              <MultiSelect
                options={ICP_COMPANY_SIZES}
                selected={criteria.company_sizes}
                onChange={v => setCriteria(prev => ({ ...prev, company_sizes: v }))}
                placeholder="Any size"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Geographies</label>
              <MultiSelect
                options={COUNTRIES.map(c => c.name)}
                selected={criteria.geographies}
                onChange={v => setCriteria(prev => ({ ...prev, geographies: v }))}
                placeholder="Any country"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Job Titles</label>
              <TagInput
                tags={criteria.titles}
                onChange={v => setCriteria(prev => ({ ...prev, titles: v }))}
                placeholder="e.g. CMO, Marketing Director"
                max={10}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Keywords</label>
              <TagInput
                tags={criteria.keywords}
                onChange={v => setCriteria(prev => ({ ...prev, keywords: v }))}
                placeholder="e.g. SaaS, B2B, growth"
                max={10}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Domains</label>
              <TagInput
                tags={criteria.domains}
                onChange={v => setCriteria(prev => ({ ...prev, domains: v }))}
                placeholder="e.g. acme.com"
                max={10}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => callEnrich(false)}
              disabled={enriching || rescoring}
              className="flex items-center gap-2 px-5 h-10 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {enriching ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Enriching…</>
              ) : (
                <><Zap className="w-4 h-4" />Enrich Prospects</>
              )}
            </button>

            {isDirty && prospects.length > 0 && (
              <button
                onClick={() => callEnrich(true)}
                disabled={enriching || rescoring}
                className="flex items-center gap-2 px-5 h-10 rounded-lg text-sm font-medium bg-slate-800 border border-slate-700 hover:border-slate-600 disabled:opacity-50 text-slate-300 hover:text-white transition-colors"
              >
                {rescoring ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" />Rescoring…</>
                ) : (
                  <><RefreshCw className="w-4 h-4" />Rescore Existing</>
                )}
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-700/40 text-red-300 text-sm px-4 py-3">
              {error}
            </div>
          )}

          {enrichResult && (
            <div className="rounded-lg bg-emerald-900/20 border border-emerald-700/40 text-emerald-300 text-sm px-4 py-3">
              Found <strong>{enrichResult.total}</strong> prospects from: {enrichResult.sources.join(', ')}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">
              Prospects
              {prospects.length > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-400">({prospects.length})</span>
              )}
            </h2>
          </div>

          {loadingProspects ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg bg-slate-800/60" />
              ))}
            </div>
          ) : (
            <ProspectTable prospects={prospects} jobId={jobId} />
          )}
        </div>
      </div>
    </div>
  )
}
