'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { PLATFORMS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, RefreshCw, Check, Copy, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

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
  company_description: string | null
  company_size: string | null
}

interface OutreachCopy {
  id: string
  copy_text: string
  status: string
  platform: string
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  if (score >= 0.7) return <Badge className="bg-emerald-900/30 border border-emerald-700/40 text-emerald-300">ICP {Math.round(score * 100)}%</Badge>
  if (score >= 0.4) return <Badge className="bg-amber-900/30 border border-amber-700/40 text-amber-300">ICP {Math.round(score * 100)}%</Badge>
  return <Badge variant="secondary" className="bg-slate-800 border-slate-700 text-slate-400">ICP {Math.round(score * 100)}%</Badge>
}

function MissingFieldWarning({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-400">
      <AlertCircle className="w-3 h-3" />
      <span>Missing: {label}</span>
    </div>
  )
}

export default function PersonalisePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const prospectId = params.prospect_id as string
  const jobIdParam = searchParams.get('job_id') ?? ''

  const supabase = getSupabaseBrowserClient()

  const [prospect, setProspect] = useState<Prospect | null>(null)
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState('linkedin')
  const [jobId, setJobId] = useState(jobIdParam)
  const [copies, setCopies] = useState<OutreachCopy[]>([])
  const [activeCopy, setActiveCopy] = useState<OutreachCopy | null>(null)
  const [copyText, setCopyText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<any[]>([])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      try {
        const { data: p } = await supabase
          .from('prospects')
          .select('*')
          .eq('id', prospectId)
          .single()

        if (p && active) setProspect(p as Prospect)

        // Load existing copies for this prospect
        const { data: copiesData } = await supabase
          .from('outreach_copies')
          .select('id,copy_text,status,platform,job_id')
          .eq('prospect_id', prospectId)
          .order('created_at', { ascending: false })

        if (copiesData && active) {
          setCopies(copiesData as OutreachCopy[])
          if (copiesData.length > 0) {
            const first = copiesData[0] as any
            setActiveCopy(first as OutreachCopy)
            setCopyText(first.copy_text ?? '')
            setPlatform(first.platform ?? 'linkedin')
            if (first.job_id) setJobId(first.job_id)
          }
        }

        // Load completed generation jobs for org
        const { data: jobsData } = await supabase
          .from('generation_jobs')
          .select('id, prompt_tags, asset_type, status')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(20)

        if (jobsData && active) setJobs(jobsData)
      } catch {
        // silent
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [prospectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    if (!jobId) {
      setError('Please select a campaign job first.')
      return
    }
    setError(null)
    setGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/personalise`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prospect_id: prospectId, job_id: jobId, platform }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const json = await res.json()
      const newCopy: OutreachCopy = { id: json.copy_id, copy_text: json.copy_text, status: 'draft', platform }
      setActiveCopy(newCopy)
      setCopyText(json.copy_text)
      setCopies(prev => [newCopy, ...prev])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const approve = async () => {
    if (!activeCopy) return
    setApproving(true)
    try {
      await supabase.from('outreach_copies').update({ status: 'approved' }).eq('id', activeCopy.id)
      setActiveCopy(prev => prev ? { ...prev, status: 'approved' } : null)
      setCopies(prev => prev.map(c => c.id === activeCopy.id ? { ...c, status: 'approved' } : c))
    } catch {
      // silent
    } finally {
      setApproving(false)
    }
  }

  const copyToClipboard = async () => {
    if (!copyText || !activeCopy) return
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      // Mark as exported
      await supabase.from('outreach_copies').update({ status: 'exported' }).eq('id', activeCopy.id)
      setActiveCopy(prev => prev ? { ...prev, status: 'exported' } : null)
    } catch {
      // silent
    }
  }

  const isApproved = activeCopy?.status === 'approved' || activeCopy?.status === 'exported'

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-8">
        <Skeleton className="h-8 w-48 bg-slate-800 mb-6" />
        <div className="grid grid-cols-3 gap-8">
          <Skeleton className="h-64 bg-slate-800 rounded-2xl" />
          <div className="col-span-2 space-y-4">
            <Skeleton className="h-10 bg-slate-800 rounded-lg" />
            <Skeleton className="h-48 bg-slate-800 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (!prospect) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Prospect not found.
      </div>
    )
  }

  const missingFields = [
    !prospect.email && 'email',
    !prospect.company_name && 'company',
    !prospect.job_title && 'title',
    !prospect.company_description && 'company description',
  ].filter(Boolean) as string[]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-screen-xl mx-auto px-6 py-8">

        {/* Back nav */}
        <Link href="/icp" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Prospects
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: Prospect sidebar */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {[prospect.first_name, prospect.last_name].filter(Boolean).join(' ') || 'Unknown'}
                </h2>
                {prospect.job_title && <p className="text-sm text-slate-400 mt-0.5">{prospect.job_title}</p>}
                {prospect.company_name && <p className="text-sm text-slate-400">{prospect.company_name}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                {prospect.enrichment_source && (
                  <Badge variant="secondary" className="bg-slate-800 border-slate-700 text-slate-400 text-xs">
                    {prospect.enrichment_source}
                  </Badge>
                )}
                <ScoreBadge score={prospect.icp_score} />
              </div>

              <div className="space-y-1 text-sm text-slate-400">
                {prospect.email && <div>{prospect.email}</div>}
                {prospect.industry && <div>{prospect.industry}</div>}
                {prospect.country && <div>{prospect.country}</div>}
                {prospect.company_size && <div>{prospect.company_size}</div>}
              </div>

              {prospect.company_description && (
                <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-800 pt-3">
                  {prospect.company_description.slice(0, 200)}
                  {prospect.company_description.length > 200 ? '…' : ''}
                </p>
              )}

              {missingFields.length > 0 && (
                <div className="border-t border-slate-800 pt-3 space-y-1">
                  {missingFields.map(f => <MissingFieldWarning key={f} label={f} />)}
                </div>
              )}
            </div>

            {/* Copy history */}
            {copies.length > 1 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">History</h3>
                {copies.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => { setActiveCopy(c); setCopyText(c.copy_text); setPlatform(c.platform) }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      activeCopy?.id === c.id
                        ? 'bg-indigo-900/30 border border-indigo-700/40 text-indigo-300'
                        : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className="capitalize">{c.platform}</span>
                    <span className="ml-2 opacity-60">v{copies.length - i}</span>
                    <Badge variant="secondary" className="ml-2 text-xs py-0 capitalize bg-slate-700 text-slate-300">
                      {c.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: generation panel */}
          <div className="lg:col-span-2 space-y-4">
            <h1 className="text-xl font-bold text-white">Personalise Outreach</h1>

            {/* Controls */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Platform</label>
                <select
                  value={platform}
                  onChange={e => setPlatform(e.target.value)}
                  disabled={isApproved}
                  className="h-9 px-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  {PLATFORMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Campaign Job</label>
                <select
                  value={jobId}
                  onChange={e => setJobId(e.target.value)}
                  disabled={isApproved}
                  className="h-9 px-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 max-w-xs"
                >
                  <option value="">Select job…</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.prompt_tags?.subject ?? j.asset_type ?? j.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={generate}
                disabled={generating || !jobId}
                className="flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                {generating ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" />{activeCopy ? 'Regenerating…' : 'Generating…'}</>
                ) : (
                  activeCopy ? 'Regenerate' : 'Generate'
                )}
              </button>
            </div>

            {error && (
              <div className="rounded-lg bg-red-900/20 border border-red-700/40 text-red-300 text-sm px-4 py-3">
                {error}
              </div>
            )}

            {/* Copy textarea */}
            <div className="space-y-2">
              <Textarea
                value={copyText}
                onChange={e => setCopyText(e.target.value)}
                readOnly={isApproved}
                rows={10}
                placeholder="Generated copy will appear here…"
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600 resize-y focus:border-indigo-500 read-only:opacity-70"
              />

              {activeCopy && (
                <div className="flex items-center gap-3 justify-end">
                  {!isApproved && (
                    <button
                      onClick={approve}
                      disabled={approving || !copyText}
                      className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors"
                    >
                      {approving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Approve
                    </button>
                  )}

                  {isApproved && (
                    <Badge className="bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 px-3 py-1.5">
                      <Check className="w-3 h-3 mr-1 inline" />
                      Approved
                    </Badge>
                  )}

                  <button
                    onClick={copyToClipboard}
                    disabled={!copyText}
                    className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {copied ? <><Check className="w-4 h-4 text-emerald-400" />Copied!</> : <><Copy className="w-4 h-4" />Copy</>}
                  </button>
                </div>
              )}
            </div>

            {/* Empty state */}
            {!activeCopy && !generating && (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <p className="text-sm">Select a platform and campaign job, then click Generate.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
