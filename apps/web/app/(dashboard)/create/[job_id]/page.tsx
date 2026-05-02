'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Download, RefreshCw, ThumbsUp, ThumbsDown, Star, ArrowRight } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

type Job = {
  id: string
  status: string
  output_url: string | null
  error_message: string | null
  asset_type: string | null
  model_id: string | null
  provider_key: string | null
  prompt_tags: any
  created_at: string
  completed_at: string | null
  generation_time_ms: number | null
  parent_job_id: string | null
  content_job_json: any
}

export default function JobResultPage() {
  const params = useParams()
  const jobId = params.job_id as string
  const router = useRouter()

  const [job, setJob] = useState<Job | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [orgSlug, setOrgSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [versions, setVersions] = useState<Job[]>([])
  const [versionSignedUrls, setVersionSignedUrls] = useState<Record<string, string>>({})
  const [thumbs, setThumbs] = useState<'up' | 'down' | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [feedbackSaved, setFeedbackSaved] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  const supabase = createClient()

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function loadJob(id: string) {
    const { data: jobData, error } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !jobData) { setNotFound(true); setLoading(false); return }

    setJob(jobData as Job)

    const { data: org } = await supabase.from('orgs').select('slug').single()
    if (org?.slug) setOrgSlug(org.slug)

    if (jobData.output_url && jobData.status === 'completed') {
      const { data: signed } = await supabase.storage.from('assets').createSignedUrl(jobData.output_url, 3600)
      if (signed?.signedUrl) setSignedUrl(signed.signedUrl)
    }

    const parentId = jobData.parent_job_id
    const orFilter = parentId
      ? 'id.eq.' + parentId + ',parent_job_id.eq.' + parentId + ',id.eq.' + id
      : 'id.eq.' + id + ',parent_job_id.eq.' + id

    const { data: vData } = await supabase
      .from('generation_jobs')
      .select('id, status, output_url, asset_type, model_id, created_at, prompt_tags, parent_job_id, generation_time_ms, error_message, provider_key, content_job_json, completed_at')
      .or(orFilter)
      .order('created_at', { ascending: true })

    if (vData) {
      setVersions(vData as Job[])
      const urlMap: Record<string, string> = {}
      for (const v of vData) {
        if (v.output_url && v.status === 'completed') {
          const { data: s } = await supabase.storage.from('assets').createSignedUrl(v.output_url, 3600)
          if (s?.signedUrl) urlMap[v.id] = s.signedUrl
        }
      }
      setVersionSignedUrls(urlMap)
    }
    setLoading(false)
  }

  useEffect(() => { loadJob(jobId) }, [jobId])

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return
    const channel = supabase.channel('job:' + jobId)
    channel.on('broadcast', { event: 'job_complete' }, async ({ payload }: any) => {
      if (payload.job_id === jobId) await loadJob(jobId)
    }).subscribe()
    const interval = setInterval(() => loadJob(jobId), 3000)
    return () => { supabase.removeChannel(channel); clearInterval(interval) }
  }, [job?.status, jobId])

  async function handleDownload() {
    if (!signedUrl) return
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const filename = (orgSlug || 'gtm') + '_' + dateStr + '_' + jobId.slice(0, 8) + '.png'
    const res = await fetch(signedUrl)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFeedback() {
    if (rating === null && thumbs === null) return
    setSubmittingFeedback(true)
    setFeedbackError(null)
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch(SUPABASE_URL + '/functions/v1/submit-feedback', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, rating, thumbs, note: note || undefined }),
      })
      if (res.ok) setFeedbackSaved(true)
      else { const e = await res.json(); setFeedbackError(e.error ?? 'Save failed') }
    } catch { setFeedbackError('Unexpected error') }
    setSubmittingFeedback(false)
  }

  function handleRegenerate() {
    const pt = job?.prompt_tags ?? {}
    const qs = new URLSearchParams()
    Object.entries(pt).forEach(([k, v]) => { if (v && typeof v === 'string') qs.set(k, v) })
    qs.set('parent_job_id', jobId)
    router.push('/create?' + qs.toString())
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  )

  if (notFound || !job) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-slate-400">Job not found.</p>
        <Button variant="outline" onClick={() => router.push('/create')} className="border-slate-700 text-slate-300">Create new</Button>
      </div>
    </div>
  )

  if (job.status === 'pending' || job.status === 'processing') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-indigo-900/50 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
          </div>
        </div>
        <div>
          <p className="text-slate-100 font-semibold">Generating your asset...</p>
          <p className="text-slate-500 text-sm mt-1">This page updates automatically.</p>
        </div>
      </div>
    </div>
  )

  if (job.status === 'failed') return (
    <div className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-6 space-y-4">
          <h1 className="text-red-300 font-semibold text-lg">Generation Failed</h1>
          <p className="text-red-400 text-sm">{job.error_message ?? 'Unknown error'}</p>
          <Button onClick={handleRegenerate} className="bg-indigo-600 hover:bg-indigo-500 text-white">
            <RefreshCw className="h-4 w-4 mr-2" />Try again
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-slate-100">Generated Asset</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleRegenerate} className="border-slate-700 text-slate-300 hover:text-slate-100">
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />Regenerate
                </Button>
                <Button size="sm" onClick={handleDownload} disabled={!signedUrl} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  <Download className="h-3.5 w-3.5 mr-2" />Download
                </Button>
              </div>
            </div>

            {signedUrl && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <img src={signedUrl} alt="Generated asset" className="w-full object-contain max-h-[70vh]" />
              </div>
            )}

            {job.generation_time_ms && (
              <p className="text-slate-600 text-xs text-right">Generated in {(job.generation_time_ms / 1000).toFixed(1)}s</p>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => router.push('/icp?job_id=' + jobId)} className="border-slate-700 text-slate-300 hover:text-slate-100">
                Use for campaign<ArrowRight className="h-3.5 w-3.5 ml-2" />
              </Button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-slate-200 font-semibold text-sm">Feedback</h2>
              {feedbackSaved ? (
                <p className="text-green-400 text-sm">Thanks for your feedback!</p>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setThumbs(thumbs === 'up' ? null : 'up')} className={'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ' + (thumbs === 'up' ? 'border-green-500 bg-green-900/30 text-green-400' : 'border-slate-700 text-slate-400 hover:border-slate-600')}>
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setThumbs(thumbs === 'down' ? null : 'down')} className={'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ' + (thumbs === 'down' ? 'border-red-500 bg-red-900/30 text-red-400' : 'border-slate-700 text-slate-400 hover:border-slate-600')}>
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1 ml-2">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} type="button" onClick={() => setRating(rating === n ? null : n)} className="focus:outline-none">
                          <Star className={'h-5 w-5 transition-colors ' + (rating !== null && n <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-amber-400')} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note..." rows={2} className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none text-sm" />
                  {feedbackError && <p className="text-red-400 text-sm">{feedbackError}</p>}
                  <Button size="sm" onClick={handleFeedback} disabled={submittingFeedback || (rating === null && thumbs === null)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                    {submittingFeedback ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Submit feedback'}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-slate-200 font-semibold text-sm">Version History</h2>
            {versions.length === 0 && <p className="text-slate-500 text-sm">No versions yet.</p>}
            {versions.map((v, i) => (
              <button key={v.id} type="button" onClick={() => router.push('/create/' + v.id)} className={'w-full text-left rounded-lg border p-3 transition-colors ' + (v.id === jobId ? 'border-indigo-500 bg-indigo-900/20' : 'border-slate-800 bg-slate-900 hover:border-slate-700')}>
                <div className="flex items-center gap-3">
                  {versionSignedUrls[v.id] ? (
                    <img src={versionSignedUrls[v.id]} alt={'v' + (i+1)} className="w-14 h-14 rounded object-cover border border-slate-700 shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                      <span className="text-slate-600 text-xs">{v.status === 'pending' ? '...' : v.status === 'failed' ? 'x' : '?'}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-slate-300 text-sm font-medium">Version {i + 1}</p>
                    <p className="text-slate-500 text-xs">{new Date(v.created_at).toLocaleDateString()}</p>
                    <span className={'inline-block mt-1 text-xs px-1.5 py-0.5 rounded ' + (v.status === 'completed' ? 'bg-green-900/40 text-green-400' : v.status === 'failed' ? 'bg-red-900/40 text-red-400' : 'bg-slate-700 text-slate-400')}>{v.status}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}