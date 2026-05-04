'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { INDUSTRIES, ICP_COMPANY_SIZES, COUNTRIES } from '@/lib/constants'
import { MultiSelect } from '@/components/icp/multi-select'
import { TagInput } from '@/components/icp/tag-input'
import { ProspectTable } from '@/components/icp/prospect-table'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, Zap, Download, History, RotateCcw } from 'lucide-react'
import { BackButton } from '@/components/layout/back-button'

interface EnrichmentRun {
  id: string
  criteria: ICPCriteria
  model_id: string | null
  source: string
  max_results: number
  prospects_found: number
  warning: string | null
  status: 'completed' | 'failed'
  error_message: string | null
  created_at: string
}

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
  const [enrichResult, setEnrichResult] = useState<{ total: number; sources: string[]; warning?: string | null } | null>(null)
  const [maxResults, setMaxResults] = useState(20)
  const [maxPerRun, setMaxPerRun] = useState<number>(20)
  const [runUsed, setRunUsed] = useState<number | null>(null)
  const [runCap, setRunCap] = useState<number>(2)
  const [planTier, setPlanTier] = useState<string>('starter')
  const [runs, setRuns] = useState<EnrichmentRun[]>([])
  const cancelRef = useRef(false)

  const loadRuns = useCallback(async () => {
    const { data } = await supabase
      .from('icp_enrichment_runs')
      .select('id,criteria,model_id,source,max_results,prospects_found,warning,status,error_message,created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setRuns(data as unknown as EnrichmentRun[])
  }, [supabase])

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

        // Load org plan + BYOK to derive caps shown in the header.
        const { data: org } = await supabase
          .from('orgs')
          .select('plan_tier, byok_mode')
          .single()
        if (org && active) {
          const tier = (org as any).plan_tier ?? 'starter'
          const byok = Boolean((org as any).byok_mode)
          setPlanTier(tier)
          // Mirror server-side PROSPECT_LIMITS in icp-enrich.
          // Runs are always counted per 30-day window across all tiers.
          const tierCaps: Record<string, { runs: number; max_per_run: number }> = {
            starter:          { runs: 2,  max_per_run: 20  },
            fully_subscribed: { runs: 15, max_per_run: 200 },
          }
          const byokCap = { runs: 50, max_per_run: 500 }
          const cap = byok ? byokCap : (tierCaps[tier] ?? tierCaps.starter)
          // TEMP (testing): caps disabled server-side. Show generous numbers in UI
          // so the dropdown isn't artificially limited. Re-tighten when paid plans go live.
          setRunCap(9999)
          setMaxPerRun(500)
          setMaxResults(prev => Math.min(prev, 500))
          // Reference (unused while testing):
          void cap
        }

        const { data: rows } = await supabase
          .from('prospects')
          .select('id,first_name,last_name,email,job_title,company_name,industry,country,enrichment_source,enrichment_data,icp_score,icp_fit_reason,status,linkedin_url,created_at')
          .order('icp_score', { ascending: false })

        if (rows && active) {
          setProspects(rows)
          // Count distinct web_search runs in the last 30 days (mirrors server logic).
          const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
          const wsRows = rows.filter((r: any) => r.enrichment_source === 'web_search')
          const buckets = new Set<string>()
          for (const r of wsRows) {
            if (new Date(r.created_at).getTime() >= monthAgo) {
              buckets.add(String(r.created_at).slice(0, 16))
            }
          }
          setRunUsed(buckets.size)
        }

        await loadRuns()
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
        body: JSON.stringify({ criteria, rescore_only: rescoreOnly, max_results: maxResults }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 429) {
          throw new Error(body.message ?? 'Usage cap reached. Try again later.')
        }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const json = await res.json()
      setProspects(json.prospects ?? [])
      setSavedCriteria(criteria)
      setEnrichResult({
        total: json.total ?? 0,
        sources: json.enrichment_sources_used ?? [],
        warning: json.warning ?? null,
      })
      // Sync caps + usage from server response (authoritative).
      if (json.limits) {
        if (typeof json.limits.run_cap === 'number') setRunCap(json.limits.run_cap)
        if (typeof json.limits.run_used === 'number') setRunUsed(json.limits.run_used)
        if (typeof json.limits.max_per_run === 'number') setMaxPerRun(json.limits.max_per_run)
        if (typeof json.limits.plan_tier === 'string') setPlanTier(json.limits.plan_tier)
      } else if (!rescoreOnly && (json.total ?? 0) > 0) {
        setRunUsed(prev => (prev ?? 0) + 1)
      }
      // Refresh run history (web_search runs always log; rescores don't).
      if (!rescoreOnly) await loadRuns()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnriching(false)
      setRescoring(false)
    }
  }, [criteria, supabase, maxResults, loadRuns])

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

        <BackButton href="/dashboard" label="Back to dashboard" />

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

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => callEnrich(false)}
                disabled={
                  enriching || rescoring
                  || (runUsed !== null && runUsed >= runCap)
                }
                className="flex items-center gap-2 px-5 h-10 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                {enriching ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" />Running AI search…</>
                ) : (
                  <><Zap className="w-4 h-4" />Find Prospects with AI</>
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

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <label className="flex items-center gap-2">
                <span className="uppercase tracking-wide">Per run</span>
                <select
                  value={maxResults}
                  onChange={e => setMaxResults(Number(e.target.value))}
                  disabled={enriching || rescoring}
                  className="h-8 rounded-md bg-slate-800 border border-slate-700 text-slate-200 px-2 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {(() => {
                    // Build tier-appropriate dropdown steps; always include the tier max.
                    const all = [5, 10, 20, 50, 100, 200, 300, 500]
                    const opts = all.filter(n => n <= maxPerRun)
                    if (!opts.includes(maxPerRun)) opts.push(maxPerRun)
                    return opts.sort((a, b) => a - b).map(n => (
                      <option key={n} value={n}>
                        {n} prospects{n === maxPerRun ? ' (max)' : ''}
                      </option>
                    ))
                  })()}
                </select>
              </label>
              {runUsed !== null && (
                <span
                  title={`Enrichment runs in the last 30 days. Each run can return up to ${maxPerRun} prospects.`}
                  className={runUsed >= runCap ? 'text-red-400' : runUsed >= runCap * 0.8 ? 'text-amber-400' : 'text-slate-500'}
                >
                  {runUsed} / {runCap} runs / month · up to {maxPerRun} each
                </span>
              )}
              <span className="text-slate-600">· {planTier}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-700/40 text-red-300 text-sm px-4 py-3">
              {error}
            </div>
          )}

          {enrichResult && (
            enrichResult.total > 0 ? (
              <div className="rounded-lg bg-emerald-900/20 border border-emerald-700/40 text-emerald-300 text-sm px-4 py-3">
                Found <strong>{enrichResult.total}</strong> prospects from: {enrichResult.sources.join(', ')}
              </div>
            ) : (
              <div className="rounded-lg bg-amber-900/20 border border-amber-700/40 text-amber-300 text-sm px-4 py-3">
                <strong>No prospects returned.</strong>{enrichResult.warning ? ` ${enrichResult.warning}` : ' Try broadening your industries, titles or geographies.'}
              </div>
            )
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

        {runs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-100">Recent runs</h2>
              <span className="text-sm font-normal text-slate-500">({runs.length})</span>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">When</th>
                    <th className="text-left px-4 py-3 font-medium">Criteria</th>
                    <th className="text-left px-4 py-3 font-medium">Model</th>
                    <th className="text-right px-4 py-3 font-medium">Found</th>
                    <th className="text-right px-4 py-3 font-medium">Asked</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {runs.map(run => {
                    const c = run.criteria ?? EMPTY_CRITERIA
                    const summaryParts: string[] = []
                    if (c.industries?.length)   summaryParts.push(`${c.industries.length} ind`)
                    if (c.geographies?.length)  summaryParts.push(c.geographies.slice(0, 2).join(', ') + (c.geographies.length > 2 ? ` +${c.geographies.length - 2}` : ''))
                    if (c.titles?.length)       summaryParts.push(c.titles.slice(0, 2).join(', ') + (c.titles.length > 2 ? ` +${c.titles.length - 2}` : ''))
                    if (c.company_sizes?.length) summaryParts.push(`${c.company_sizes.length} size`)
                    const summary = summaryParts.join(' · ') || '—'
                    const when = new Date(run.created_at)
                    const dateLabel = when.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    const failed = run.status === 'failed' || run.prospects_found === 0
                    return (
                      <tr key={run.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap" title={when.toISOString()}>{dateLabel}</td>
                        <td className="px-4 py-3 text-slate-300 max-w-md truncate" title={summary}>{summary}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{run.model_id?.split('/').pop() ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-100">{run.prospects_found}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{run.max_results}</td>
                        <td className="px-4 py-3">
                          {failed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-900/30 text-amber-300 border border-amber-700/40" title={run.error_message ?? run.warning ?? ''}>
                              {run.status === 'failed' ? 'failed' : 'no results'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-900/30 text-emerald-300 border border-emerald-700/40">
                              completed
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setCriteria({ ...EMPTY_CRITERIA, ...c })
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                            title="Load this criteria into the form"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reuse
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Showing your last {runs.length} runs. Prospects from every run remain saved above and can be exported any time.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
