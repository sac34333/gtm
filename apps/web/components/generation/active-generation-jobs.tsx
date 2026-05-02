'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Loader2, Image, Video } from 'lucide-react'

type ActiveJob = {
  id: string
  status: string
  asset_type: string | null
  model_id: string | null
  created_at: string
  prompt_tags: any
}

export function ActiveGenerationJobs({ orgId }: { orgId: string }) {
  const [jobs, setJobs] = useState<ActiveJob[]>([])
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  async function loadActiveJobs() {
    const { data } = await supabase
      .from('generation_jobs')
      .select('id, status, asset_type, model_id, created_at, prompt_tags')
      .eq('org_id', orgId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setJobs(data as ActiveJob[])
  }

  useEffect(() => {
    loadActiveJobs()

    // Subscribe to DB-level changes (org-wide — catches any job status update)
    const dbChannel = supabase
      .channel('active-jobs-' + orgId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'generation_jobs', filter: 'org_id=eq.' + orgId },
        () => { loadActiveJobs() }
      )
      .subscribe()

    return () => { supabase.removeChannel(dbChannel) }
  }, [orgId])

  // Subscribe to per-job broadcast channels for instant completion events
  useEffect(() => {
    if (jobs.length === 0) return
    const channels = jobs.map(job => {
      const ch = supabase.channel('job:' + job.id)
      ch.on('broadcast', { event: 'job_complete' }, ({ payload }: any) => {
        if (payload.job_id === job.id) {
          setJobs(prev => prev.filter(j => j.id !== job.id))
          router.push('/create/' + job.id)
        }
      }).subscribe()
      return ch
    })
    return () => { channels.forEach(ch => supabase.removeChannel(ch)) }
  }, [jobs.map(j => j.id).join(',')])

  if (jobs.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-slate-400 text-sm font-medium">In Progress</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {jobs.map(job => {
          const subject = job.prompt_tags?.subject as string | undefined
          const Icon = job.asset_type === 'video' ? Video : Image
          const elapsed = Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000)
          const elapsedStr = elapsed < 60 ? elapsed + 's' : Math.round(elapsed / 60) + 'min'

          return (
            <button
              key={job.id}
              type="button"
              onClick={() => router.push('/create/' + job.id)}
              className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-left hover:border-slate-700 transition-colors group"
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-lg bg-indigo-900/40 border border-indigo-700/30 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-950 flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-slate-200 text-sm font-medium truncate">
                  {subject || 'Generating…'}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {job.status} · {elapsedStr} ago
                </p>
              </div>
              <span className="text-indigo-500 text-xs group-hover:text-indigo-400 transition-colors shrink-0">View →</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
