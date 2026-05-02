'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft, Megaphone, Target, Droplets, Rocket,
  Briefcase, Mail, MessageSquare, AtSign,
  Image as ImageIcon, FileText, Download, RefreshCw,
  Calendar, Clock, Hash, CheckCircle, AlertCircle,
  Loader2, Plus, X, ChevronRight, ExternalLink,
} from 'lucide-react'

type TabKey = 'calendar' | 'prospects' | 'brief'

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
  description: string | null
}

interface Prospect {
  id: string
  prospect_id: string
  first_name: string | null
  last_name: string | null
  job_title: string | null
  company_name: string | null
  icp_score: number | null
}

interface OutreachCopy {
  id: string
  prospect_id: string
  platform: string
  status: string | null
  copy_text: string | null
}

const TYPE_CONFIG: Record<string, { label: string; Icon: any }> = {
  awareness: { label: 'Awareness', Icon: Megaphone },
  lead_gen: { label: 'Lead Gen', Icon: Target },
  nurture: { label: 'Nurture', Icon: Droplets },
  product_launch: { label: 'Product Launch', Icon: Rocket },
}

const CHANNEL_ICONS: Record<string, any> = {
  linkedin_message: Briefcase,
  linkedin_post: Briefcase,
  email: Mail,
  cold_dm: MessageSquare,
  AtSign: AtSign,
}

const COPY_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-800 border-slate-700 text-slate-400',
  approved: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300',
  rejected: 'bg-red-900/30 border-red-700/40 text-red-300',
}

// ─── Content Calendar Tab ────────────────────────────────────────────────────

function CalendarTab({ campaign, onGenerateBrief, generating }: {
  campaign: Campaign
  onGenerateBrief: () => void
  generating: boolean
}) {
  const schedule: any[] = campaign.brief_data?.posting_schedule ?? []
  const hashtags: string[] = campaign.brief_data?.hashtags ?? []
  const bestTimes: Record<string, string> = campaign.brief_data?.best_time_to_post ?? {}

  if (!campaign.brief_data && !generating) {
    return (
      <div className="py-16 text-center">
        <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-300 font-medium">No brief generated yet</p>
        <p className="text-slate-500 text-sm mt-1 mb-6">Generate a campaign brief to see the 14-day content calendar.</p>
        <button
          onClick={onGenerateBrief}
          className="inline-flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Generate Brief
        </button>
      </div>
    )
  }

  if (generating) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
        <p className="text-slate-300">Generating campaign brief…</p>
        <p className="text-slate-500 text-sm mt-1">This usually takes 15–30 seconds.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* 14-day posting schedule grid */}
      {schedule.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" /> Posting schedule
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {schedule.slice(0, 14).map((day: any, idx: number) => (
              <div key={idx} className="rounded-lg border border-slate-800 bg-slate-900/40 px-2 py-3 text-center">
                <div className="text-xs text-slate-500 mb-1">Day {idx + 1}</div>
                <div className="text-xs font-medium text-white truncate">{day.channel ?? day.platform ?? '—'}</div>
                {day.theme && <div className="text-xs text-slate-600 mt-0.5 truncate">{day.theme}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best time to post */}
      {Object.keys(bestTimes).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" /> Best time to post
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(bestTimes).map(([channel, time]) => {
              const Icon = CHANNEL_ICONS[channel] ?? MessageSquare
              return (
                <div key={channel} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/40">
                  <Icon className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs text-slate-400">{channel}</span>
                  <span className="text-xs text-white font-medium">{time}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Hashtags */}
      {hashtags.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-slate-500" /> Hashtag bank
          </h3>
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag: string) => (
              <span key={tag} className="px-2 py-1 rounded-md text-xs bg-slate-800 border border-slate-700 text-slate-400">
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Regenerate button */}
      <div className="pt-4 border-t border-slate-800">
        <button
          onClick={onGenerateBrief}
          className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Regenerate brief
        </button>
      </div>
    </div>
  )
}

// ─── Prospects & Copy Tab ────────────────────────────────────────────────────

function ProspectsTab({ campaign, prospects, copies }: {
  campaign: Campaign
  prospects: Prospect[]
  copies: OutreachCopy[]
}) {
  const channels = campaign.channel_mix ?? []

  const copyMap: Record<string, Record<string, OutreachCopy>> = {}
  for (const cp of copies) {
    if (!copyMap[cp.prospect_id]) copyMap[cp.prospect_id] = {}
    copyMap[cp.prospect_id][cp.platform] = cp
  }

  if (prospects.length === 0) {
    return (
      <div className="py-16 text-center">
        <MessageSquare className="w-10 h-10 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-300 font-medium">No prospects yet</p>
        <p className="text-slate-500 text-sm mt-1 mb-6">Add prospects from your ICP list to start generating personalised copy.</p>
        <Link href="/icp">
          <button className="inline-flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            <Plus className="w-4 h-4" />
            Go to ICP
          </button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{prospects.length} prospect{prospects.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Prospect</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">ICP Score</th>
              {channels.map(ch => (
                <th key={ch} className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-1">
                    {(() => { const I = CHANNEL_ICONS[ch] ?? MessageSquare; return <I className="w-3 h-3" /> })()}
                    {ch.replace(/_/g, ' ')}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {prospects.map(p => {
              const pCopies = copyMap[p.prospect_id] ?? {}
              const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unnamed'
              return (
                <tr key={p.id} className="hover:bg-slate-900/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{fullName}</div>
                    {p.company_name && <div className="text-xs text-slate-500">{p.job_title ? `${p.job_title} at ${p.company_name}` : p.company_name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {p.icp_score !== null ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        p.icp_score >= 0.7 ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' :
                        p.icp_score >= 0.4 ? 'bg-amber-900/30 border-amber-700/40 text-amber-300' :
                        'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                        {(p.icp_score * 100).toFixed(0)}%
                      </span>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  {channels.map(ch => {
                    const copy = pCopies[ch]
                    const statusCfg = COPY_STATUS_COLOR[copy?.status ?? ''] ?? 'bg-slate-800 border-slate-700 text-slate-500'
                    return (
                      <td key={ch} className="px-4 py-3">
                        {copy ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${statusCfg}`}>
                            {copy.status ?? 'draft'}
                          </span>
                        ) : (
                          <span className="text-slate-700 text-xs">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Brief & Assets Tab ──────────────────────────────────────────────────────

function BriefTab({ campaign, onGenerateBrief, generating }: {
  campaign: Campaign
  onGenerateBrief: () => void
  generating: boolean
}) {
  const supabase = getSupabaseBrowserClient()
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null)
  const [signedAssetUrl, setSignedAssetUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!campaign.pdf_url) return
    const path = campaign.pdf_url.replace(/^briefs\//, '')
    supabase.storage.from('briefs').createSignedUrl(path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setSignedPdfUrl(data.signedUrl) })
  }, [campaign.pdf_url]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-8">
      {/* Asset */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-slate-500" /> Creative asset
        </h3>
        {campaign.job_id ? (
          <Link href={`/create/${campaign.job_id}`} className="group inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-all">
            <ImageIcon className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-300 group-hover:text-white">View linked asset</span>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
          </Link>
        ) : (
          <Link href="/create">
            <button className="inline-flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Create an asset
            </button>
          </Link>
        )}
      </div>

      {/* PDF */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" /> Campaign brief PDF
        </h3>
        {campaign.pdf_url ? (
          <div className="space-y-4">
            {signedPdfUrl && (
              <iframe
                src={signedPdfUrl}
                className="w-full h-96 rounded-xl border border-slate-800"
                title="Campaign Brief PDF"
              />
            )}
            <div className="flex items-center gap-3">
              {signedPdfUrl && (
                <>
                  <a href={signedPdfUrl} download target="_blank" rel="noopener noreferrer">
                    <button className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </button>
                  </a>
                  <a href={signedPdfUrl} target="_blank" rel="noopener noreferrer">
                    <button className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> View PDF
                    </button>
                  </a>
                </>
              )}
              <button
                onClick={onGenerateBrief}
                disabled={generating}
                className="flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 transition-colors disabled:opacity-40"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Regenerate
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 py-10 text-center">
            <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No brief yet</p>
            <button
              onClick={onGenerateBrief}
              disabled={generating}
              className="mt-4 inline-flex items-center gap-2 px-4 h-8 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Generate Brief
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = getSupabaseBrowserClient()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [copies, setCopies] = useState<OutreachCopy[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('calendar')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [campRes, prospectsRes, copiesRes] = await Promise.all([
      supabase.from('campaign_briefs').select('*').eq('id', id).single(),
      supabase.from('campaign_prospects')
        .select('id,prospect_id,prospects(first_name,last_name,job_title,company_name,icp_score)')
        .eq('campaign_id', id),
      supabase.from('outreach_copies').select('id,prospect_id,platform,status,copy_text').eq('campaign_id', id),
    ])

    if (campRes.data) setCampaign(campRes.data as Campaign)

    if (prospectsRes.data) {
      setProspects(prospectsRes.data.map((row: any) => ({
        id: row.id,
        prospect_id: row.prospect_id,
        ...(row.prospects ?? {}),
      })))
    }

    if (copiesRes.data) setCopies(copiesRes.data as OutreachCopy[])
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))

    // Realtime subscription for brief completion
    const channel = supabase
      .channel(`campaign:${id}`)
      .on('broadcast', { event: 'brief_complete' }, () => { load() })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'campaign_briefs', filter: `id=eq.${id}`,
      }, () => { load() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerateBrief() {
    setGenerating(true)
    setGenerateError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-campaign-brief`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ campaign_id: id }),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to generate brief')
      }
      await load()
    } catch (e: any) {
      setGenerateError(e.message ?? 'Unexpected error')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-10 space-y-6">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <Skeleton className="h-24 w-full bg-slate-800" />
        <Skeleton className="h-64 w-full bg-slate-800" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-300">Campaign not found</p>
          <Link href="/campaigns" className="text-indigo-400 text-sm mt-2 block hover:text-indigo-300">← Back to campaigns</Link>
        </div>
      </div>
    )
  }

  const typeCfg = TYPE_CONFIG[campaign.campaign_type ?? '']
  const TypeIcon = typeCfg?.Icon ?? Megaphone
  const channels = campaign.channel_mix ?? []
  const approved = copies.filter(c => c.status === 'approved').length
  const total = prospects.length * channels.length

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-screen-xl mx-auto px-6 py-10 space-y-8">

        {/* Back link */}
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Campaigns
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <TypeIcon className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {typeCfg && (
                  <span className="text-xs text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">
                    {typeCfg.label}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                  campaign.status === 'active' ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' :
                  campaign.status === 'paused' ? 'bg-amber-900/30 border-amber-700/40 text-amber-300' :
                  campaign.status === 'completed' ? 'bg-slate-700/40 border-slate-600/40 text-slate-400' :
                  'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  {campaign.status ?? 'draft'}
                </span>
                {channels.map(ch => {
                  const Icon = CHANNEL_ICONS[ch] ?? MessageSquare
                  return <Icon key={ch} className="w-3.5 h-3.5 text-slate-500" />
                })}
              </div>
            </div>
          </div>

          {/* Copy progress summary */}
          {total > 0 && (
            <div className="hidden md:block min-w-[160px] shrink-0 text-right">
              <div className="text-xs text-slate-500 mb-1">{approved}/{total} copies approved</div>
              <Progress value={total > 0 ? Math.round((approved / total) * 100) : 0} className="h-1.5 bg-slate-800" />
            </div>
          )}
        </div>

        {/* Error banner */}
        {generateError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-950/40 border border-red-800/50 px-4 py-3">
            <X className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{generateError}</p>
            <button onClick={() => setGenerateError(null)} className="ml-auto text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-800">
          <nav className="flex gap-0">
            {([
              { key: 'calendar', label: 'Content Calendar', Icon: Calendar },
              { key: 'prospects', label: `Prospects & Copy (${prospects.length})`, Icon: MessageSquare },
              { key: 'brief', label: 'Brief & Assets', Icon: FileText },
            ] as { key: TabKey; label: string; Icon: any }[]).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'calendar' && (
            <CalendarTab campaign={campaign} onGenerateBrief={handleGenerateBrief} generating={generating} />
          )}
          {activeTab === 'prospects' && (
            <ProspectsTab campaign={campaign} prospects={prospects} copies={copies} />
          )}
          {activeTab === 'brief' && (
            <BriefTab campaign={campaign} onGenerateBrief={handleGenerateBrief} generating={generating} />
          )}
        </div>
      </div>
    </div>
  )
}
