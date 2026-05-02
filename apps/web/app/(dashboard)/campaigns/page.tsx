'use client'

import { useState, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Download, ExternalLink, BookOpen } from 'lucide-react'

interface CampaignBrief {
  id: string
  name: string | null
  status: string | null
  created_at: string
  pdf_url: string | null
  brief_data: any
  job_id: string | null
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'active') return <Badge className="bg-emerald-900/30 border border-emerald-700/40 text-emerald-300">Active</Badge>
  if (status === 'draft') return <Badge variant="secondary" className="bg-slate-800 border-slate-700 text-slate-400">Draft</Badge>
  return <Badge variant="secondary" className="bg-slate-800 border-slate-700 text-slate-400 capitalize">{status ?? 'unknown'}</Badge>
}

function BriefCard({ brief, onDownload }: { brief: CampaignBrief; onDownload: (brief: CampaignBrief) => void }) {
  const date = new Date(brief.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const schedule: any[] = brief.brief_data?.posting_schedule ?? []
  const captions: string[] = brief.brief_data?.caption_variants?.primary_platform ?? []
  const hashtags: string[] = brief.brief_data?.hashtag_sets?.general ?? []

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white truncate">{brief.name ?? 'Campaign Brief'}</h3>
          <p className="text-sm text-slate-400 mt-0.5">{date}</p>
        </div>
        <StatusBadge status={brief.status} />
      </div>

      {/* Brief summary */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-slate-800/60 border border-slate-700/50 px-3 py-2">
          <div className="text-xl font-bold text-white">{schedule.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Scheduled Posts</div>
        </div>
        <div className="rounded-lg bg-slate-800/60 border border-slate-700/50 px-3 py-2">
          <div className="text-xl font-bold text-white">{captions.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Caption Variants</div>
        </div>
        <div className="rounded-lg bg-slate-800/60 border border-slate-700/50 px-3 py-2">
          <div className="text-xl font-bold text-white">{hashtags.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Hashtags</div>
        </div>
      </div>

      {/* Caption preview */}
      {captions[0] && (
        <div className="rounded-lg bg-slate-800/40 border border-slate-700/40 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><BookOpen className="w-3 h-3" />Primary caption preview</p>
          <p className="text-sm text-slate-300 leading-relaxed line-clamp-2">{captions[0]}</p>
        </div>
      )}

      {/* Hashtags */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hashtags.slice(0, 6).map((tag: string) => (
            <Badge key={tag} variant="secondary" className="bg-slate-800 border-slate-700 text-slate-400 text-xs">{tag}</Badge>
          ))}
          {hashtags.length > 6 && (
            <Badge variant="secondary" className="bg-slate-800 border-slate-700 text-slate-400 text-xs">+{hashtags.length - 6} more</Badge>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
        {brief.pdf_url ? (
          <>
            <button
              onClick={() => onDownload(brief)}
              className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
            <button
              onClick={() => onDownload(brief)}
              className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View PDF
            </button>
          </>
        ) : (
          <span className="text-xs text-slate-600">No PDF available</span>
        )}
      </div>
    </div>
  )
}

export default function CampaignsPage() {
  const supabase = getSupabaseBrowserClient()
  const [briefs, setBriefs] = useState<CampaignBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('campaign_briefs')
          .select('id,name,status,created_at,pdf_url,brief_data,job_id')
          .order('created_at', { ascending: false })
        if (data && active) setBriefs(data as CampaignBrief[])
      } catch {
        // silent
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = async (brief: CampaignBrief) => {
    if (!brief.pdf_url) return
    setDownloadingId(brief.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Get signed URL via storage API
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/sign/briefs/${brief.pdf_url.replace(/^briefs\//, '')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ expiresIn: 3600 }),
        }
      )

      if (!res.ok) {
        // Fallback: direct storage download
        const { data } = await supabase.storage.from('briefs').createSignedUrl(
          brief.pdf_url.replace(/^briefs\/[^/]+\//, '').replace(/^briefs\//, ''),
          3600,
        )
        if (data?.signedUrl) window.open(data.signedUrl, '_blank')
        return
      }

      const { signedURL } = await res.json()
      if (signedURL) window.open(signedURL, '_blank')
    } catch {
      // silent
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-screen-xl mx-auto px-6 py-10 space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-slate-400 text-sm mt-1">Campaign briefs with AI-generated posting schedules and copy variants.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl bg-slate-800/60" />
            ))}
          </div>
        ) : briefs.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-slate-800">
            <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No campaign briefs yet.</p>
            <p className="text-slate-600 text-xs mt-1">Generate a brief from the creation flow to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {briefs.map(brief => (
              <BriefCard
                key={brief.id}
                brief={brief}
                onDownload={handleDownload}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
