'use client'

import { useState, useEffect, useCallback } from 'react'
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
  duration_days: number | null
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

const CAMPAIGN_STATUS_OPTIONS = [
  { value: 'draft',     label: 'Draft',     cls: 'bg-slate-800 border-slate-700 text-slate-400' },
  { value: 'active',    label: 'Active',    cls: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' },
  { value: 'paused',    label: 'Paused',    cls: 'bg-amber-900/30 border-amber-700/40 text-amber-300' },
  { value: 'completed', label: 'Completed', cls: 'bg-slate-700/40 border-slate-600/40 text-slate-400' },
] as const

function CampaignStatusSelect({
  campaignId, value, onChange,
}: { campaignId: string; value: string | null; onChange: (next: string) => void }) {
  const supabase = getSupabaseBrowserClient()
  const [saving, setSaving] = useState(false)
  const current = value ?? 'draft'
  const opt = CAMPAIGN_STATUS_OPTIONS.find(o => o.value === current) ?? CAMPAIGN_STATUS_OPTIONS[0]

  async function update(next: string) {
    if (next === current || saving) return
    setSaving(true)
    onChange(next) // optimistic
    const { error } = await supabase
      .from('campaign_briefs')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
    setSaving(false)
    if (error) {
      onChange(current) // rollback
    }
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={current}
        onChange={(e) => update(e.target.value)}
        disabled={saving}
        className={`appearance-none cursor-pointer pl-2.5 pr-6 py-0.5 rounded-full border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${opt.cls} ${saving ? 'opacity-60' : ''}`}
        aria-label="Campaign status"
      >
        {CAMPAIGN_STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value} className="bg-slate-900 text-slate-200">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronRight className="w-3 h-3 absolute right-1.5 pointer-events-none rotate-90 opacity-60" />
    </div>
  )
}

// ─── Content Calendar Tab ────────────────────────────────────────────────────

function CalendarTab({ campaign, onGenerateBrief, generating }: {
  campaign: Campaign
  onGenerateBrief: () => void
  generating: boolean
}) {
  const supabase = getSupabaseBrowserClient()
  const brief = campaign.brief_data ?? null
  const durationDays: number = Math.max(1, Math.min(90, Number(campaign.duration_days ?? 14)))
  const schedule: any[] = brief?.posting_schedule ?? []
  const hashtagSets: Record<string, string[]> = brief?.hashtag_sets ?? {}
  const flatHashtags: string[] = brief?.hashtags ?? []
  const timing: Record<string, any> = brief?.timing_recommendations ?? brief?.best_time_to_post ?? {}
  const summary: string | undefined = brief?.executive_summary
  const keyMessages: string[] = brief?.key_messages ?? []
  const primaryCta: string | undefined = brief?.primary_cta
  const audienceProfile: { total?: number; summary?: string; top_industries?: string[] } | undefined = brief?.audience_profile

  // Live "X of N contacted" counter — counts prospects whose last_campaign_id
  // points at this campaign. Updates whenever a brief generation flips status.
  const [contactedCount, setContactedCount] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    async function loadCount() {
      const { count } = await supabase
        .from('prospects')
        .select('id', { count: 'exact', head: true })
        .eq('last_campaign_id', campaign.id)
      if (active) setContactedCount(count ?? 0)
    }
    loadCount()
    return () => { active = false }
  }, [supabase, campaign.id])

  if (!brief && !generating) {
    return (
      <div className="py-16 text-center">
        <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-300 font-medium">No brief generated yet</p>
        <p className="text-slate-500 text-sm mt-1 mb-6">Generate a campaign brief to see the {durationDays}-day content calendar.</p>
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
      </div>
    )
  }

  // Phase color tokens (covers all 4 campaign-type arcs)
  const phaseStyles: Record<string, string> = {
    // product_launch
    pre_launch: 'bg-amber-900/30 border-amber-700/40 text-amber-300',
    launch:     'bg-indigo-900/30 border-indigo-700/40 text-indigo-300',
    sustain:    'bg-emerald-900/30 border-emerald-700/40 text-emerald-300',
    recap:      'bg-violet-900/30 border-violet-700/40 text-violet-300',
    // lead_gen
    problem_framing: 'bg-rose-900/30 border-rose-700/40 text-rose-300',
    solution:        'bg-indigo-900/30 border-indigo-700/40 text-indigo-300',
    proof:           'bg-emerald-900/30 border-emerald-700/40 text-emerald-300',
    ask:             'bg-amber-900/30 border-amber-700/40 text-amber-300',
    // nurture
    value_share: 'bg-sky-900/30 border-sky-700/40 text-sky-300',
    relevance:   'bg-indigo-900/30 border-indigo-700/40 text-indigo-300',
    peer_proof:  'bg-emerald-900/30 border-emerald-700/40 text-emerald-300',
    soft_ask:    'bg-violet-900/30 border-violet-700/40 text-violet-300',
    // awareness
    warm_up: 'bg-amber-900/30 border-amber-700/40 text-amber-300',
    peak:    'bg-indigo-900/30 border-indigo-700/40 text-indigo-300',
  }

  return (
    <div className="space-y-10">
      {/* Audience profile — who this brief was tuned for */}
      {audienceProfile?.summary && (
        <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-5">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              <span className="text-xs uppercase tracking-wide text-indigo-300">Audience · {audienceProfile.total ?? 0} prospect(s) from your ICP</span>
            </div>
            {contactedCount !== null && (audienceProfile.total ?? 0) > 0 && (
              <Link
                href={`/icp?campaign=${campaign.id}`}
                className="text-[11px] uppercase tracking-wide text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1"
                title="View these prospects in the ICP list"
              >
                {contactedCount} of {audienceProfile.total ?? 0} contacted
                <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {audienceProfile.summary}
          </div>
          {audienceProfile.top_industries && audienceProfile.top_industries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {audienceProfile.top_industries.map(ind => (
                <span key={ind} className="px-2 py-0.5 rounded-md text-[11px] bg-indigo-900/40 border border-indigo-800/50 text-indigo-300">{ind}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Executive summary + key messages */}
      {(summary || keyMessages.length > 0) && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          {summary && (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Executive summary</div>
              <p className="text-sm text-slate-200 leading-relaxed">{summary}</p>
            </div>
          )}
          {keyMessages.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Key messages</div>
              <ul className="space-y-1.5">
                {keyMessages.map((m, i) => (
                  <li key={i} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-indigo-400 shrink-0">•</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {primaryCta && (
            <div className="pt-2 border-t border-slate-800">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Primary CTA</div>
              <p className="text-sm font-semibold text-indigo-300">{primaryCta}</p>
            </div>
          )}
        </div>
      )}

      {/* Launch arc */}
      {schedule.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" /> {durationDays}-day launch arc
          </h3>
          <div className="space-y-2">
            {schedule.slice(0, durationDays).map((day: any, idx: number) => {
              const channel = day.channel ?? day.platform ?? '—'
              const Icon = CHANNEL_ICONS[channel] ?? MessageSquare
              const phase = (day.phase ?? '') as string
              const phaseClass = phaseStyles[phase] ?? 'bg-slate-800 border-slate-700 text-slate-400'
              return (
                <div key={idx} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-slate-800 bg-slate-900/40">
                  <div className="text-center shrink-0 w-12">
                    <div className="text-xs text-slate-500">Day</div>
                    <div className="text-sm font-bold text-white">{day.day ?? idx + 1}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm font-medium text-white">{channel.replace(/_/g, ' ')}</span>
                      {phase && <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${phaseClass}`}>{phase.replace(/_/g, ' ')}</span>}
                      {day.post_type && <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded border border-slate-700">{day.post_type}</span>}
                      <span className="text-xs text-slate-500 ml-auto">{day.recommended_date} · {day.time_local ?? ''}</span>
                    </div>
                    {day.theme && <div className="text-xs text-slate-300 mt-1.5 font-medium">{day.theme}</div>}
                    {day.hook && <div className="text-xs text-slate-500 mt-0.5 italic">{day.hook}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Channel timing recs */}
      {Object.keys(timing).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" /> Channel timing & best practices
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(timing).map(([channel, rec]) => {
              const Icon = CHANNEL_ICONS[channel] ?? MessageSquare
              const isObj = rec && typeof rec === 'object'
              return (
                <div key={channel} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-sm font-medium text-white">{channel.replace(/_/g, ' ')}</span>
                  </div>
                  {isObj ? (
                    <div className="space-y-1 text-xs">
                      {rec.best_days?.length > 0 && (
                        <div className="text-slate-400"><span className="text-slate-500">Days:</span> {rec.best_days.join(', ')}</div>
                      )}
                      {rec.best_times?.length > 0 && (
                        <div className="text-slate-400"><span className="text-slate-500">Times:</span> {rec.best_times.join(', ')}</div>
                      )}
                      {rec.rationale && (
                        <div className="text-slate-500 italic mt-1">{rec.rationale}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">{String(rec)}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Hashtag bank — grouped */}
      {(Object.keys(hashtagSets).some(k => (hashtagSets as any)[k]?.length) || flatHashtags.length > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-slate-500" /> Hashtag bank
          </h3>
          {Object.keys(hashtagSets).some(k => (hashtagSets as any)[k]?.length) ? (
            <div className="space-y-3">
              {(['branded', 'industry', 'general', 'niche', 'regional'] as const).map(group => {
                const tags = (hashtagSets as any)[group] as string[] | undefined
                if (!tags?.length) return null
                return (
                  <div key={group}>
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">{group}</div>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag: string) => (
                        <span key={tag} className="px-2 py-1 rounded-md text-xs bg-slate-800 border border-slate-700 text-slate-300">
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {flatHashtags.map((tag: string) => (
                <span key={tag} className="px-2 py-1 rounded-md text-xs bg-slate-800 border border-slate-700 text-slate-400">
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          )}
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

function ProspectsTab({ campaign, prospects, copies, onRegenerateCopies, onUpdateCopyStatus, regenerating }: {
  campaign: Campaign
  prospects: Prospect[]
  copies: OutreachCopy[]
  onRegenerateCopies: () => Promise<void> | void
  onUpdateCopyStatus: (copyId: string, nextStatus: 'approved' | 'rejected' | 'draft') => Promise<void> | void
  regenerating: boolean
}) {
  const channels = campaign.channel_mix ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copyConfirm, setCopyConfirm] = useState(false)

  const copyMap: Record<string, Record<string, OutreachCopy>> = {}
  for (const cp of copies) {
    if (!copyMap[cp.prospect_id]) copyMap[cp.prospect_id] = {}
    copyMap[cp.prospect_id][cp.platform] = cp
  }

  const selectedCopy = selectedId ? copies.find(c => c.id === selectedId) ?? null : null
  const selectedProspect = selectedCopy ? prospects.find(p => p.prospect_id === selectedCopy.prospect_id) ?? null : null

  const totalExpected = prospects.length * channels.length
  const generated = copies.length
  const approved = copies.filter(c => c.status === 'approved').length

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

  async function copySelectedToClipboard() {
    if (!selectedCopy?.copy_text) return
    try {
      await navigator.clipboard.writeText(selectedCopy.copy_text)
      setCopyConfirm(true)
      setTimeout(() => setCopyConfirm(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          <span className="text-white font-medium">{generated}</span> generated ·{' '}
          <span className="text-emerald-300 font-medium">{approved}</span> approved ·{' '}
          <span className="text-slate-500">of {totalExpected} expected</span>
        </div>
        <button
          onClick={() => onRegenerateCopies()}
          disabled={regenerating}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {generated === 0 ? 'Generate copies' : 'Regenerate copies'}
        </button>
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
                    const isSelected = copy && selectedId === copy.id
                    return (
                      <td key={ch} className="px-4 py-3">
                        {copy ? (
                          <button
                            onClick={() => setSelectedId(isSelected ? null : copy.id)}
                            className={`inline-block px-2 py-0.5 rounded-full text-xs border transition ${statusCfg} ${isSelected ? 'ring-2 ring-indigo-400/60' : 'hover:opacity-80'}`}
                          >
                            {copy.status ?? 'draft'}
                          </button>
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

      {/* Selected copy preview / approval panel */}
      {selectedCopy && (
        <div className="rounded-xl border border-indigo-700/40 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                {selectedCopy.platform.replace(/_/g, ' ')} · {selectedProspect ? [selectedProspect.first_name, selectedProspect.last_name].filter(Boolean).join(' ') : 'Prospect'}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Status: <span className="text-slate-300">{selectedCopy.status ?? 'draft'}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">
            {selectedCopy.copy_text ?? <span className="text-slate-600 italic">(empty)</span>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onUpdateCopyStatus(selectedCopy.id, 'approved')}
              disabled={selectedCopy.status === 'approved'}
              className="inline-flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {selectedCopy.status === 'approved' ? 'Approved' : 'Approve'}
            </button>
            <button
              onClick={() => onUpdateCopyStatus(selectedCopy.id, 'rejected')}
              disabled={selectedCopy.status === 'rejected'}
              className="inline-flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-medium border border-red-800/60 bg-red-950/40 hover:bg-red-900/40 text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-3.5 h-3.5" />
              {selectedCopy.status === 'rejected' ? 'Rejected' : 'Reject'}
            </button>
            {(selectedCopy.status === 'approved' || selectedCopy.status === 'rejected') && (
              <button
                onClick={() => onUpdateCopyStatus(selectedCopy.id, 'draft')}
                className="inline-flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-medium border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
              >
                Reset to draft
              </button>
            )}
            <button
              onClick={copySelectedToClipboard}
              disabled={!selectedCopy.copy_text}
              className="inline-flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-medium border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
            >
              {copyConfirm ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <ExternalLink className="w-3.5 h-3.5" />}
              {copyConfirm ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>
        </div>
      )}
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

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
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
        const msg = err.retryable === true || res.status === 503 || res.status === 502
          ? (err.error ?? 'AI provider is temporarily unavailable. Your campaign was not charged — please try again.')
          : res.status === 401 && err.code === 'auth_failed'
            ? (err.error ?? 'API key issue — check your provider key in Settings.')
            : (err.error ?? 'Failed to generate brief')
        throw new Error(msg)
      }
      await load()
    } catch (e: any) {
      setGenerateError(e.message ?? 'Unexpected error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerateCopies() {
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
          body: JSON.stringify({ campaign_id: id, copies_only: true }),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to regenerate copies')
      }
      await load()
    } catch (e: any) {
      setGenerateError(e.message ?? 'Unexpected error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleUpdateCopyStatus(copyId: string, nextStatus: 'approved' | 'rejected' | 'draft') {
    const prev = copies
    setCopies(cs => cs.map(c => c.id === copyId ? { ...c, status: nextStatus } : c))
    const { error: updErr } = await supabase
      .from('outreach_copies')
      .update({ status: nextStatus })
      .eq('id', copyId)
    if (updErr) {
      setCopies(prev) // revert
      setGenerateError(`Failed to update copy: ${updErr.message}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen text-slate-100 p-4 md:p-10 space-y-6">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <Skeleton className="h-24 w-full bg-slate-800" />
        <Skeleton className="h-64 w-full bg-slate-800" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen text-slate-100 flex items-center justify-center">
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
    <div className="min-h-screen text-slate-100">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8">

        {/* Back link */}
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Campaigns
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-glow-violet">
              <TypeIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gtm-title tracking-tight">{campaign.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {typeCfg && (
                  <span className="text-xs text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">
                    {typeCfg.label}
                  </span>
                )}
                <CampaignStatusSelect
                  campaignId={campaign.id}
                  value={campaign.status}
                  onChange={(next) => setCampaign({ ...campaign, status: next })}
                />
                {channels.map(ch => {
                  const Icon = CHANNEL_ICONS[ch] ?? MessageSquare
                  return <Icon key={ch} className="w-3.5 h-3.5 text-slate-500" />
                })}
              </div>
            </div>
          </div>

          {/* Copy progress summary */}
          {total > 0 && (
            <div className="hidden md:block min-w-[180px] shrink-0 text-right space-y-1.5">
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-2xl font-bold gtm-title-accent tabular-nums">{Math.round((approved / total) * 100)}</span>
                <span className="text-sm text-slate-500">%</span>
              </div>
              <div className="text-[11px] text-slate-500">{approved} of {total} copies approved</div>
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
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                  activeTab === key
                    ? 'border-indigo-400 text-white drop-shadow-[0_0_10px_rgba(129,140,248,0.45)]'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-white/10'
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
            <ProspectsTab
              campaign={campaign}
              prospects={prospects}
              copies={copies}
              onRegenerateCopies={handleRegenerateCopies}
              onUpdateCopyStatus={handleUpdateCopyStatus}
              regenerating={generating}
            />
          )}
          {activeTab === 'brief' && (
            <BriefTab campaign={campaign} onGenerateBrief={handleGenerateBrief} generating={generating} />
          )}
        </div>
      </div>
    </div>
  )
}
