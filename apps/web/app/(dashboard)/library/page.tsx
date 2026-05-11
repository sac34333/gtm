'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ImageIcon, Video, Sparkles, AlertCircle, Clock, CheckCircle2, XCircle, Layers, ThumbsUp, ThumbsDown, Trash2, Loader2, Film } from 'lucide-react'
import { LinkedinIcon } from '@/components/icons/linkedin-icon'
import { format } from 'date-fns'
import { BackButton } from '@/components/layout/back-button'
import { LinkedInComposeDialog, type LinkedInComposeAsset } from '@/components/settings/linkedin-compose-dialog'

interface JobRow {
  id: string
  asset_type: string
  status: string
  output_url: string | null
  created_at: string
  prompt_tags: { subject?: string } | null
  model_id: string | null
  error_message: string | null
  parent_job_id: string | null
  captions: { _status?: 'pending' | 'ready' | 'failed' } | null
}

interface StackedJob {
  latest: JobRow
  versionCount: number
  isRefinement: boolean
  thumbs: 'up' | 'down' | null
}

const FETCH_LIMIT = 120 // fetch enough rows to group into ~24 stacks even with multiple versions
const STACK_LIMIT = 30

async function fetchJobs(filter: 'all' | 'image' | 'video') {
  const supabase = getSupabaseBrowserClient()
  let q = supabase
    .from('generation_jobs')
    .select('id, asset_type, status, output_url, created_at, prompt_tags, model_id, error_message, parent_job_id, captions')
    .order('created_at', { ascending: false })
    .limit(FETCH_LIMIT)
  if (filter !== 'all') q = q.eq('asset_type', filter)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as JobRow[]
}

// Walk parent_job_id chain to find the root id (or self if no parent in fetched set).
function findRootId(jobId: string, byId: Map<string, JobRow>): string {
  let current = byId.get(jobId)
  let safety = 10
  while (current && current.parent_job_id && byId.has(current.parent_job_id) && safety-- > 0) {
    current = byId.get(current.parent_job_id)!
  }
  return current?.id ?? jobId
}

function groupIntoStacks(jobs: JobRow[]): StackedJob[] {
  const byId = new Map(jobs.map(j => [j.id, j]))
  const groups = new Map<string, JobRow[]>()
  for (const j of jobs) {
    const root = findRootId(j.id, byId)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(j)
  }
  // For each group, latest = first (since input is desc by created_at, but be safe)
  const stacks: StackedJob[] = []
  for (const [, members] of groups) {
    const sorted = [...members].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    const latest = sorted[0]
    stacks.push({
      latest,
      versionCount: sorted.length,
      isRefinement: latest.parent_job_id !== null,
      thumbs: null,
    })
  }
  // Sort stacks by latest activity desc
  stacks.sort((a, b) => +new Date(b.latest.created_at) - +new Date(a.latest.created_at))
  return stacks.slice(0, STACK_LIMIT)
}

async function fetchFeedbackForJobs(jobIds: string[]): Promise<Record<string, 'up' | 'down'>> {
  if (jobIds.length === 0) return {}
  const supabase = getSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const { data } = await supabase
    .from('generation_feedback')
    .select('job_id, thumbs')
    .in('job_id', jobIds)
    .eq('user_id', user.id)
  const map: Record<string, 'up' | 'down'> = {}
  for (const row of data ?? []) {
    if (row.thumbs === 'up' || row.thumbs === 'down') map[row.job_id as string] = row.thumbs
  }
  return map
}

function ThumbCard({ stack, onRequestDelete, isDeleting, onLinkedIn, linkedInConnected }: { stack: StackedJob; onRequestDelete: (stack: StackedJob) => void; isDeleting: boolean; onLinkedIn: (asset: LinkedInComposeAsset) => void; linkedInConnected: boolean }) {
  const job = stack.latest
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const subject = job.prompt_tags?.subject ?? 'Untitled'

  useEffect(() => {
    if (!job.output_url || job.status !== 'completed') return
    const supabase = getSupabaseBrowserClient()
    const path = job.output_url.replace(/^assets\//, '')
    supabase.storage.from('assets').createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setSignedUrl(data.signedUrl)
    })
  }, [job.output_url, job.status])

  const isImage = job.asset_type === 'image'
  const hasVersions = stack.versionCount > 1

  return (
    <div className="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-indigo flex flex-col">
      {/* Faux stack effect for cards with versions */}
      {hasVersions && (
        <>
          <div className="absolute -top-1 -right-1 left-1 bottom-1 bg-slate-800 border border-slate-700 rounded-xl -z-10" aria-hidden />
          <div className="absolute -top-2 -right-2 left-2 bottom-2 bg-slate-800/60 border border-slate-700/60 rounded-xl -z-20" aria-hidden />
        </>
      )}

      {/* Image — tappable link to the detail page */}
      <Link href={`/create/${job.id}`} className="block">
        <div className="aspect-square bg-slate-950 relative flex items-center justify-center overflow-hidden">
          {job.status === 'completed' && signedUrl && isImage && (
            <img src={signedUrl} alt={subject} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          )}
          {job.status === 'completed' && !isImage && (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Video className="w-10 h-10" />
              <span className="text-xs">Video ready</span>
            </div>
          )}
          {(job.status === 'pending' || job.status === 'processing') && (
            <div className="flex flex-col items-center gap-2 text-amber-400">
              <Clock className="w-8 h-8 animate-pulse" />
              <span className="text-xs">Generating…</span>
            </div>
          )}
          {job.status === 'failed' && (
            <div className="flex flex-col items-center gap-2 text-red-400">
              <XCircle className="w-8 h-8" />
              <span className="text-xs">Failed</span>
            </div>
          )}

          {/* Top-left: asset-type pill + refinement chip */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
            <div className="bg-slate-950/80 backdrop-blur border border-slate-700 rounded-md px-1.5 py-0.5 flex items-center gap-1">
              {isImage ? <ImageIcon className="w-3 h-3 text-slate-300" /> : <Video className="w-3 h-3 text-slate-300" />}
              <span className="text-[10px] text-slate-300 capitalize">{job.asset_type}</span>
            </div>
            {hasVersions && (
              <div className="bg-indigo-500/30 backdrop-blur border border-indigo-400/50 rounded-md px-2 py-0.5 flex items-center gap-1 shadow-sm">
                <Layers className="w-3 h-3 text-indigo-200 shrink-0" />
                <span className="text-[10px] font-medium text-indigo-100 whitespace-nowrap">{stack.versionCount} versions</span>
              </div>
            )}
          </div>

          {/* Top-right: status + thumbs feedback */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {job.status === 'completed' && (
              <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-full p-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              </div>
            )}
            {stack.thumbs === 'up' && (
              <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-md px-1.5 py-0.5 flex items-center gap-1">
                <ThumbsUp className="w-3 h-3 text-emerald-400" />
              </div>
            )}
            {stack.thumbs === 'down' && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-md px-1.5 py-0.5 flex items-center gap-1">
                <ThumbsDown className="w-3 h-3 text-red-400" />
              </div>
            )}
            {job.captions?._status === 'ready' && (
              <div className="bg-sky-500/20 border border-sky-500/30 rounded-md px-1.5 py-0.5 flex items-center gap-1" title="Captions ready">
                <span className="text-[10px] text-sky-300 font-medium">✍️ copy</span>
              </div>
            )}
            {job.captions?._status === 'pending' && (
              <div className="bg-amber-500/20 border border-amber-500/30 rounded-md px-1.5 py-0.5 flex items-center gap-1" title="Writing captions…">
                <span className="text-[10px] text-amber-300 font-medium animate-pulse">writing…</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Footer — always visible, no hover required */}
      <div className="p-3 border-t border-slate-800 flex items-start gap-2">
        {/* Title + date — links to detail page */}
        <Link href={`/create/${job.id}`} className="flex-1 min-w-0 space-y-0.5">
          <p className="text-xs text-slate-200 line-clamp-2 leading-snug">{subject}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[10px] text-slate-500">{format(new Date(job.created_at), 'MMM d, h:mm a')}</p>
            {hasVersions && <p className="text-[10px] text-indigo-400">latest of {stack.versionCount}</p>}
          </div>
        </Link>

        {/* Action buttons — always visible, mobile-friendly */}
        <div className="flex items-center gap-0.5 shrink-0 -mr-0.5">
          {/* Animate this image → video */}
          {job.status === 'completed' && isImage && (
            <Link
              href={`/create?parent_job_id=${job.id}&asset_type=video`}
              title="Animate this image into a video"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 active:bg-violet-500/20 transition-colors touch-manipulation"
            >
              <Film className="w-4 h-4" />
            </Link>
          )}
          {linkedInConnected && job.status === 'completed' && isImage && signedUrl && (
            <button
              type="button"
              title="Post to LinkedIn"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onLinkedIn({ jobId: job.id, subject, signedUrl })
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-[#0077B5] hover:bg-[#0077B5]/10 active:bg-[#0077B5]/20 transition-colors touch-manipulation"
            >
              <LinkedinIcon className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            aria-label="Delete asset"
            title={hasVersions ? `Delete latest version (${stack.versionCount} total)` : 'Delete asset'}
            disabled={isDeleting}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRequestDelete(stack) }}
            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-colors touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LibraryPage() {
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')
  const [pendingDelete, setPendingDelete] = useState<StackedJob | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeAsset, setComposeAsset] = useState<LinkedInComposeAsset | null>(null)
  const [linkedInConnected, setLinkedInConnected] = useState(false)
  const queryClient = useQueryClient()

  // Check LinkedIn connection once on mount
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    supabase
      .from('org_linkedin_connections')
      .select('org_id')
      .maybeSingle()
      .then(({ data }) => setLinkedInConnected(data !== null))
  }, [])

  const { data: jobs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['library-jobs', filter],
    queryFn: () => fetchJobs(filter),
    staleTime: 30 * 1000,
    // Auto-refresh every 5 s while any job is still generating
    refetchInterval: (query) => {
      const rows = query.state.data as JobRow[] | undefined
      return rows?.some(j => j.status === 'pending' || j.status === 'processing') ? 5000 : false
    },
  })

  const stacks = groupIntoStacks(jobs)

  const { data: feedbackMap = {} } = useQuery({
    queryKey: ['library-feedback', stacks.map(s => s.latest.id).join(',')],
    queryFn: () => fetchFeedbackForJobs(stacks.map(s => s.latest.id)),
    enabled: stacks.length > 0,
    staleTime: 30 * 1000,
  })

  const stacksWithFeedback = stacks.map(s => ({ ...s, thumbs: feedbackMap[s.latest.id] ?? null }))

  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not signed in')
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-asset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ job_id: jobId }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Delete failed (${res.status})`)
      }
      return jobId
    },
    onSuccess: () => {
      setPendingDelete(null)
      setDeleteError(null)
      queryClient.invalidateQueries({ queryKey: ['library-jobs'] })
    },
    onError: (err: Error) => {
      setDeleteError(err.message)
    },
  })

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 md:py-8 space-y-6">
        <BackButton href="/dashboard" label="Back to dashboard" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold gtm-title tracking-tight">Library</h1>
            <p className="text-slate-400 text-sm mt-1">All your generated images and videos. Refinements and regenerations are stacked together.</p>
            <p className="text-amber-300/80 text-xs mt-2">Note: assets are auto-deleted 30 days after creation. Please download and save anything you want to keep.</p>
          </div>
          <Link href="/create">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              New generation
            </Button>
          </Link>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 border-b border-slate-800 pb-3">
          {([
            { key: 'all', label: 'All' },
            { key: 'image', label: 'Images' },
            { key: 'video', label: 'Videos' },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                filter === f.key
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
                  : 'bg-transparent border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square bg-slate-900 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-red-300">Failed to load your library.</p>
            <Button variant="outline" className="border-slate-700 text-slate-100 hover:bg-slate-800" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : stacksWithFeedback.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center space-y-3">
            <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-300">No generations yet.</p>
            <p className="text-xs text-slate-500">Create your first image or video to see it here.</p>
            <Link href="/create" className="inline-block">
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white mt-2">
                <Sparkles className="w-4 h-4 mr-2" />
                Start creating
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 gtm-stagger">
            {stacksWithFeedback.map(stack => (
              <ThumbCard
                key={stack.latest.id}
                stack={stack}
                onRequestDelete={(s) => { setDeleteError(null); setPendingDelete(s) }}
                isDeleting={deleteMutation.isPending && pendingDelete?.latest.id === stack.latest.id}
                onLinkedIn={(asset) => { setComposeAsset(asset); setComposeOpen(true) }}
                linkedInConnected={linkedInConnected}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm-delete modal */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => { if (!deleteMutation.isPending) { setPendingDelete(null); setDeleteError(null) } }}
        >
          <div
            className="bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">Delete this asset?</h2>
                <p className="text-sm text-slate-400 mt-1">
                  &quot;{pendingDelete.latest.prompt_tags?.subject ?? 'Untitled'}&quot;
                </p>
                {pendingDelete.versionCount > 1 && (
                  <p className="text-xs text-amber-300/90 mt-2">
                    Note: this only deletes the latest version. The {pendingDelete.versionCount - 1} earlier version{pendingDelete.versionCount - 1 === 1 ? '' : 's'} in this stack will remain.
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2">This permanently removes the file from storage. This cannot be undone.</p>
              </div>
            </div>
            {deleteError && (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="border-slate-700 text-slate-200 hover:bg-slate-800"
                disabled={deleteMutation.isPending}
                onClick={() => { setPendingDelete(null); setDeleteError(null) }}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-500 text-white"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(pendingDelete.latest.id)}
              >
                {deleteMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 className="w-4 h-4 mr-2" /> Delete</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn compose dialog */}
      <LinkedInComposeDialog
        open={composeOpen}
        onOpenChange={(o) => { setComposeOpen(o); if (!o) setComposeAsset(null) }}
        initialAsset={composeAsset}
      />
    </div>
  )
}
