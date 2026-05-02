'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Plus, Megaphone, Target, Droplets, Rocket,
  Linkedin, Twitter, Mail, MessageSquare,
  Image as ImageIcon, ChevronRight, MoreHorizontal,
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string | null
  campaign_type: string | null
  channel_mix: string[] | null
  start_date: string | null
  end_date: string | null
  created_at: string
  pdf_url: string | null
  brief_data: any
  job_id: string | null
  prospect_count?: number
  approved_copies?: number
  total_copy_slots?: number
  asset_url?: string | null
}

const TYPE_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  awareness: { label: 'Awareness', color: 'bg-indigo-900/40 border-indigo-700/40 text-indigo-300', Icon: Megaphone },
  lead_gen: { label: 'Lead Gen', color: 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300', Icon: Target },
  nurture: { label: 'Nurture', color: 'bg-amber-900/40 border-amber-700/40 text-amber-300', Icon: Droplets },
  product_launch: { label: 'Product Launch', color: 'bg-purple-900/40 border-purple-700/40 text-purple-300', Icon: Rocket },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-800 border-slate-700 text-slate-400' },
  active: { label: 'Active', color: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' },
  paused: { label: 'Paused', color: 'bg-amber-900/30 border-amber-700/40 text-amber-300' },
  completed: { label: 'Completed', color: 'bg-slate-700/40 border-slate-600/40 text-slate-400' },
}

const CHANNEL_ICONS: Record<string, any> = {
  linkedin_message: Linkedin,
  linkedin_post: Linkedin,
  email: Mail,
  cold_dm: MessageSquare,
  twitter: Twitter,
}

function ChannelIcon({ channel }: { channel: string }) {
  const Icon = CHANNEL_ICONS[channel] ?? MessageSquare
  return <Icon className="w-3.5 h-3.5 text-slate-400" />
}

function TypeBadge({ type }: { type: string | null }) {
  const cfg = TYPE_CONFIG[type ?? ''] ?? { label: type ?? 'Unknown', color: 'bg-slate-800 border-slate-700 text-slate-400', Icon: Megaphone }
  const { Icon } = cfg
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const cfg = STATUS_CONFIG[status ?? ''] ?? { label: status ?? 'Unknown', color: 'bg-slate-800 border-slate-700 text-slate-400' }
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs border font-medium ${cfg.color}`}>{cfg.label}</span>
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const channels = campaign.channel_mix ?? []
  const prospects = campaign.prospect_count ?? 0
  const approved = campaign.approved_copies ?? 0
  const total = campaign.total_copy_slots ?? 0
  const progress = total > 0 ? Math.round((approved / total) * 100) : 0

  const date = new Date(campaign.created_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <Link href={`/campaigns/${campaign.id}`} className="block group">
      <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-slate-800 bg-slate-900/40
        hover:border-slate-700 hover:bg-slate-900/60 transition-all cursor-pointer">
        {/* Asset thumbnail */}
        <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center shrink-0">
          <ImageIcon className="w-5 h-5 text-slate-600" />
        </div>

        {/* Name + type */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm truncate max-w-[200px]">{campaign.name}</span>
            <TypeBadge type={campaign.campaign_type} />
            <StatusBadge status={campaign.status} />
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
            <span>{date}</span>
            {campaign.start_date && (
              <span>{campaign.start_date}{campaign.end_date ? ` → ${campaign.end_date}` : ''}</span>
            )}
          </div>
        </div>

        {/* Channels */}
        <div className="hidden md:flex items-center gap-1.5">
          {channels.map(ch => <ChannelIcon key={ch} channel={ch} />)}
        </div>

        {/* Prospects */}
        <div className="hidden lg:block text-center min-w-[60px]">
          <div className="text-base font-bold text-white">{prospects}</div>
          <div className="text-xs text-slate-500">prospects</div>
        </div>

        {/* Copy progress */}
        <div className="hidden lg:block min-w-[120px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">{approved}/{total || '–'} copies</span>
            {total > 0 && <span className="text-xs text-slate-500">{progress}%</span>}
          </div>
          {total > 0 && (
            <Progress value={progress} className="h-1.5 bg-slate-800" />
          )}
          {total === 0 && <div className="text-xs text-slate-600">No copies yet</div>}
        </div>

        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
      </div>
    </Link>
  )
}

export default function CampaignsPage() {
  const supabase = getSupabaseBrowserClient()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        // Fetch campaigns
        const { data: campaignData } = await supabase
          .from('campaign_briefs')
          .select('id,name,status,campaign_type,channel_mix,start_date,end_date,created_at,pdf_url,brief_data,job_id')
          .order('created_at', { ascending: false })

        if (!campaignData || !active) return

        // For each campaign, get prospect count and copy stats
        const enriched = await Promise.all(campaignData.map(async (c: any) => {
          const [prospectRes, copyRes] = await Promise.all([
            supabase.from('campaign_prospects').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id),
            supabase.from('outreach_copies').select('status').eq('campaign_id', c.id),
          ])

          const prospectCount = prospectRes.count ?? 0
          const copies = copyRes.data ?? []
          const approvedCopies = copies.filter((cp: any) => cp.status === 'approved').length
          const totalCopySlots = prospectCount * (c.channel_mix?.length ?? 0)

          return {
            ...c,
            prospect_count: prospectCount,
            approved_copies: approvedCopies,
            total_copy_slots: totalCopySlots,
          } as Campaign
        }))

        if (active) setCampaigns(enriched)
      } catch {
        // silent
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = campaigns.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (typeFilter !== 'all' && c.campaign_type !== typeFilter) return false
    return true
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-screen-xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Campaigns</h1>
            <p className="text-slate-400 text-sm mt-1">Manage multi-channel outreach campaigns with AI-generated content.</p>
          </div>
          <Link href="/campaigns/new">
            <button className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
              <Plus className="w-4 h-4" />
              New Campaign
            </button>
          </Link>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status filter */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-800 p-1">
            {['all', 'draft', 'active', 'paused', 'completed'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 h-7 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {/* Type filter */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-800 p-1">
            {['all', 'awareness', 'lead_gen', 'nurture', 'product_launch'].map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 h-7 rounded-md text-xs font-medium transition-colors ${
                  typeFilter === t
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {t === 'all' ? 'All Types' : TYPE_CONFIG[t]?.label ?? t}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl bg-slate-800/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 rounded-2xl border border-dashed border-slate-800">
            <Megaphone className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No campaigns yet</p>
            <p className="text-slate-500 text-sm mt-1 mb-6">
              Create your first campaign to start generating personalised outreach.
            </p>
            <Link href="/campaigns/new">
              <button className="inline-flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                <Plus className="w-4 h-4" />
                New Campaign
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => <CampaignRow key={c.id} campaign={c} />)}
          </div>
        )}
      </div>
    </div>
  )
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
