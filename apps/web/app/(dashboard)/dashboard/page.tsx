import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SignalFeed } from '@/components/signals/signal-feed'
import { ActiveGenerationJobs } from '@/components/generation/active-generation-jobs'
import { TrendingUp, Image, Video } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.org_id
  if (!orgId) redirect('/create-org')

  const { data: org } = await supabase
    .from('orgs')
    .select('image_used, image_quota, video_used, video_quota, signal_ingestion_enabled')
    .eq('id', orgId)
    .single()

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gtm-title tracking-tight">Trend Intelligence</h1>
            <p className="text-slate-400 mt-1 text-sm">Signals ranked by relevance to your brand themes.</p>
          </div>
          {/* Usage meters */}
          {org && (
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Image className="h-3.5 w-3.5" />
                <span className="tabular-nums">{org.image_used ?? 0} / {org.image_quota ?? 50}</span>
                <span className="text-slate-600">images</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5" />
                <span className="tabular-nums">{org.video_used ?? 0} / {org.video_quota ?? 5}</span>
                <span className="text-slate-600">videos</span>
              </div>
            </div>
          )}
        </div>

        {/* Ingestion disabled notice */}
        {!org?.signal_ingestion_enabled && (
          <div className="rounded-lg bg-slate-800/50 border border-slate-700 px-4 py-3 flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-slate-500 shrink-0" />
            <p className="text-slate-400 text-sm">
              Signal ingestion is off.{' '}
              <a href="/settings" className="text-indigo-400 hover:underline">
                Turn it on in Settings
              </a>{' '}
              to start receiving trend signals.
            </p>
          </div>
        )}

        <SignalFeed orgId={orgId} />

        <ActiveGenerationJobs orgId={orgId} />
      </div>
    </div>
  )
}
