'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Download, RefreshCw, ThumbsUp, ThumbsDown, Star, ArrowRight, Copy, Check, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { BackButton } from '@/components/layout/back-button'
import { SocialCopySection } from '@/components/generation/social-copy-section'

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
  captions: any
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
  const [promptOpen, setPromptOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  const supabase = getSupabaseBrowserClient()

  async function copyPrompt() {
    const text = job?.content_job_json?.compiled_prompt ?? ''
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
      const path = jobData.output_url.replace(/^assets\//, '')
      const { data: signed } = await supabase.storage.from('assets').createSignedUrl(path, 3600)
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
          const path = v.output_url.replace(/^assets\//, '')
          const { data: s } = await supabase.storage.from('assets').createSignedUrl(path, 3600)
          if (s?.signedUrl) urlMap[v.id] = s.signedUrl
        }
      }
      setVersionSignedUrls(urlMap)
    }

    // Load this user's existing feedback for this job (if any)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: existing } = await supabase
        .from('generation_feedback')
        .select('thumbs, rating, feedback_text')
        .eq('job_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (existing) {
        setThumbs((existing.thumbs as 'up' | 'down' | null) ?? null)
        setRating(existing.rating ?? null)
        setNote(existing.feedback_text ?? '')
        setFeedbackSaved(true)
      } else {
        setThumbs(null); setRating(null); setNote(''); setFeedbackSaved(false)
      }
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
    const ext = job?.asset_type === 'video' ? 'mp4' : 'png'
    const filename = (orgSlug || 'gtm') + '_' + dateStr + '_' + jobId.slice(0, 8) + '.' + ext
    try {
      const res = await fetch(signedUrl)
      if (!res.ok) throw new Error('Download failed: ' + res.status)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Signed URL may have expired — re-fetch and retry once
      if (!job?.output_url) return
      const path = job.output_url.replace(/^assets\//, '')
      const { data: refreshed } = await supabase.storage.from('assets').createSignedUrl(path, 3600)
      if (!refreshed?.signedUrl) return
      setSignedUrl(refreshed.signedUrl)
      const res2 = await fetch(refreshed.signedUrl)
      if (!res2.ok) return
      const blob2 = await res2.blob()
      const url2 = URL.createObjectURL(blob2)
      const a2 = document.createElement('a')
      a2.href = url2; a2.download = filename; a2.click()
      URL.revokeObjectURL(url2)
    }
  }

  async function handleFeedback() {
    if (rating === null && thumbs === null) return
    setSubmittingFeedback(true)
    setFeedbackError(null)
    const token = await getToken()
    if (!token) { setSubmittingFeedback(false); return }
    try {
      const res = await fetch(SUPABASE_URL + '/functions/v1/submit-feedback', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, rating, thumbs, note: note || undefined }),
      })
      if (res.ok) setFeedbackSaved(true)
      else { const e = await res.json(); setFeedbackError(e.error ?? 'Save failed') }
    } catch { setFeedbackError('Unexpected error') } finally { setSubmittingFeedback(false) }
  }

  function handleRegenerate() {
    const pt = job?.prompt_tags ?? {}
    const qs = new URLSearchParams()
    Object.entries(pt).forEach(([k, v]) => { if (v && typeof v === 'string') qs.set(k, v) })
    qs.set('parent_job_id', jobId)
    router.push('/create?' + qs.toString())
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  )

  if (notFound || !job) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-slate-400">Job not found.</p>
        <Button variant="outline" onClick={() => router.push('/create')} className="border-slate-700 text-slate-300">Create new</Button>
      </div>
    </div>
  )

  if (job.status === 'pending' || job.status === 'processing') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="relative max-w-md w-full mx-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/40 backdrop-blur-xl p-8 text-center space-y-5 shadow-glass-lg">
        <div className="absolute inset-0 gtm-mesh opacity-40 pointer-events-none" />
        <div className="relative space-y-5">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full border-2 border-indigo-400/40 animate-ping" />
            <div className="absolute inset-1 rounded-full border border-fuchsia-400/30 animate-ping" style={{ animationDelay: '-0.5s' }} />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-glow-violet">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          </div>
          <div>
            <p className="font-semibold text-lg gtm-shimmer-text">
              {job.asset_type === 'video' ? 'Generating your video…' : 'Generating your asset…'}
            </p>
            <p className="text-slate-400 text-sm mt-1">This page updates automatically.</p>
          </div>
          {job.asset_type === 'video' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-sm text-amber-300 text-left">
              <p className="font-medium">Video generation is async</p>
              <p className="mt-1 text-amber-400/80">You can leave this page — we'll email you when it's done and update the dashboard in real time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (job.status === 'failed') return (
    <div className="min-h-screen px-4 py-8">
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
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <BackButton href="/library" label="Back to library" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-slate-100">Generated Asset</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleRegenerate} className="!bg-slate-800 !text-slate-100 border-slate-700 hover:!bg-slate-700">
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />Regenerate
                </Button>
                <Button size="sm" onClick={handleDownload} disabled={!signedUrl} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  <Download className="h-3.5 w-3.5 mr-2" />
                  {job.asset_type === 'video' ? 'Download MP4' : 'Download'}
                </Button>
              </div>
            </div>

            {signedUrl && job.asset_type !== 'video' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <img src={signedUrl} alt="Generated asset" className="w-full object-contain max-h-[70vh]" />
              </div>
            )}

            {signedUrl && job.asset_type === 'video' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <video
                  controls
                  className="w-full rounded-xl"
                  src={signedUrl}
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            {versions.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs text-slate-500 shrink-0 mr-1">Versions</span>
                {versions.map((v, idx) => {
                  const isActive = v.id === jobId
                  const url = versionSignedUrls[v.id]
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => { if (!isActive) router.push('/create/' + v.id) }}
                      className={`relative shrink-0 rounded-lg overflow-hidden border transition ${isActive ? 'border-indigo-400 ring-2 ring-indigo-500/50' : 'border-slate-700 hover:border-slate-500'}`}
                      title={'V' + (idx + 1) + ' • ' + new Date(v.created_at).toLocaleString()}
                    >
                      <div className="w-16 h-16 bg-slate-800 flex items-center justify-center">
                        {url ? (
                          v.asset_type === 'video' ? (
                            <div className="text-[10px] text-slate-300">▶ V{idx + 1}</div>
                          ) : (
                            <img src={url} alt={'V' + (idx + 1)} className="w-full h-full object-cover" />
                          )
                        ) : v.status === 'failed' ? (
                          <span className="text-[10px] text-red-400">V{idx + 1}<br/>failed</span>
                        ) : (
                          <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                        )}
                      </div>
                      <span className={`absolute bottom-0 left-0 right-0 text-center text-[10px] py-0.5 font-medium ${isActive ? 'bg-indigo-500/90 text-white' : 'bg-slate-900/80 text-slate-300'}`}>
                        V{idx + 1}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {job.generation_time_ms && (
              <p className="text-slate-600 text-xs text-right">Generated in {(job.generation_time_ms / 1000).toFixed(1)}s</p>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => router.push('/icp?job_id=' + jobId)} className="!bg-slate-800 !text-slate-100 border-slate-700 hover:!bg-slate-700">
                Use for campaign<ArrowRight className="h-3.5 w-3.5 ml-2" />
              </Button>
            </div>

            {/* Social copy — auto-generated per platform */}
            {job.status === 'completed' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <SocialCopySection jobId={job.id} captions={job.captions ?? null} />
              </div>
            )}

            {/* Prompt Details */}
            {job.content_job_json && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setPromptOpen(o => !o)} className="w-full flex items-center justify-between p-5 hover:bg-slate-900/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <h2 className="text-slate-200 font-semibold text-sm">What worked: prompt &amp; settings</h2>
                  </div>
                  {promptOpen ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                </button>
                {promptOpen && (
                  <div className="px-5 pb-5 space-y-4 border-t border-slate-800 pt-4">
                    {/* Model + timing */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide mb-1">Model</p>
                        <p className="text-slate-200 font-mono break-all">{job.model_id ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide mb-1">Provider</p>
                        <p className="text-slate-200">{job.provider_key ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide mb-1">Time</p>
                        <p className="text-slate-200">{job.generation_time_ms ? (job.generation_time_ms / 1000).toFixed(1) + 's' : '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide mb-1">Aspect</p>
                        <p className="text-slate-200">{job.content_job_json?.image_config?.aspect_ratio ?? job.prompt_tags?.aspect_ratio ?? '—'}</p>
                      </div>
                    </div>

                    {/* Signal seed */}
                    {job.content_job_json?.signal_headline && (
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <p className="text-slate-500 uppercase tracking-wide text-xs mb-1">Seeded from signal</p>
                        <p className="text-slate-300 text-sm">{job.content_job_json.signal_headline}</p>
                      </div>
                    )}

                    {/* Chip selections */}
                    {job.prompt_tags && Object.keys(job.prompt_tags).length > 0 && (
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide text-xs mb-2">Selections</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(job.prompt_tags).filter(([_, v]) => v && typeof v === 'string').map(([k, v]) => (
                            <span key={k} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs">
                              <span className="text-slate-500">{k.replace(/_/g, ' ')}:</span>
                              <span className="text-slate-200">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Compiled prompt */}
                    {job.content_job_json?.compiled_prompt && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-slate-500 uppercase tracking-wide text-xs">Final prompt</p>
                          <button type="button" onClick={copyPrompt} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
                            {copied ? <><Check className="h-3 w-3 text-green-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                          </button>
                        </div>
                        <pre className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">{job.content_job_json.compiled_prompt}</pre>
                      </div>
                    )}

                    {/* Negative prompt */}
                    {job.content_job_json?.compiled_negative && (
                      <div>
                        <p className="text-slate-500 uppercase tracking-wide text-xs mb-2">Avoided</p>
                        <p className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-xs text-slate-400">{job.content_job_json.compiled_negative}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-200 font-semibold text-sm">Feedback</h2>
                {feedbackSaved && <span className="text-xs text-emerald-400">Saved ✓</span>}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => { setThumbs(thumbs === 'up' ? null : 'up'); setFeedbackSaved(false) }} className={'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ' + (thumbs === 'up' ? 'border-green-500 bg-green-900/30 text-green-400' : 'border-slate-700 text-slate-400 hover:border-slate-600')}>
                  <ThumbsUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => { setThumbs(thumbs === 'down' ? null : 'down'); setFeedbackSaved(false) }} className={'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ' + (thumbs === 'down' ? 'border-red-500 bg-red-900/30 text-red-400' : 'border-slate-700 text-slate-400 hover:border-slate-600')}>
                  <ThumbsDown className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1 ml-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => { setRating(rating === n ? null : n); setFeedbackSaved(false) }} className="focus:outline-none">
                      <Star className={'h-5 w-5 transition-colors ' + (rating !== null && n <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-amber-400')} />
                    </button>
                  ))}
                </div>
              </div>
              <Textarea value={note} onChange={e => { setNote(e.target.value); setFeedbackSaved(false) }} placeholder="Optional note..." rows={2} className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none text-sm" />
              {feedbackError && <p className="text-red-400 text-sm">{feedbackError}</p>}
              <Button size="sm" onClick={handleFeedback} disabled={submittingFeedback || feedbackSaved || (rating === null && thumbs === null)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {submittingFeedback ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : feedbackSaved ? 'Saved' : 'Submit feedback'}
              </Button>
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-slate-300 text-sm font-medium">Version {i + 1}</p>
                      {v.id === jobId && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">current</span>}
                    </div>
                    <p className="text-slate-500 text-xs">{new Date(v.created_at).toLocaleDateString()} · {v.generation_time_ms ? (v.generation_time_ms / 1000).toFixed(1) + 's' : '—'}</p>
                    {v.prompt_tags?.style && (
                      <p className="text-slate-400 text-xs mt-0.5 truncate">Style: {v.prompt_tags.style}</p>
                    )}
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