'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Megaphone, Target, Droplets, Rocket,
  Briefcase, Mail, MessageSquare, AtSign, CheckCircle,
  ArrowLeft, ArrowRight, Image as ImageIcon, Loader2, X, Info,
} from 'lucide-react'
import { BackButton } from '@/components/layout/back-button'

type Step = 1 | 2 | 3

interface CampaignType { key: string; label: string; sub: string; Icon: any }
interface Channel { key: string; label: string; sub: string; Icon: any }

const CAMPAIGN_TYPES: CampaignType[] = [
  { key: 'awareness', label: 'Awareness', sub: 'Build brand visibility', Icon: Megaphone },
  { key: 'lead_gen', label: 'Lead Gen', sub: 'Convert new prospects', Icon: Target },
  { key: 'nurture', label: 'Nurture', sub: 'Warm existing pipeline', Icon: Droplets },
  { key: 'product_launch', label: 'Product Launch', sub: 'Announce something new', Icon: Rocket },
]

// Tooltip content shown when the user hovers the info icon on each campaign
// type tile in step 1. Explains what the type means + which channels we will
// pre-select for it in step 2.
const CAMPAIGN_TYPE_DETAILS: Record<string, { meaning: string; channels: string }> = {
  awareness: {
    meaning: 'Build brand visibility and category POV — no hard ask. Best when you want to be seen and build authority over weeks (thought leadership, founder voice, contrarian takes).',
    channels: 'LinkedIn Post + Twitter',
  },
  lead_gen: {
    meaning: 'Convert cold + warm prospects into booked meetings or trial signups. Best when you have an ICP list and need pipeline this quarter.',
    channels: 'Email + LinkedIn DM + LinkedIn Post',
  },
  nurture: {
    meaning: 'Re-warm leads that already know you but haven\u2019t bought — ex-trial users, ghosted inbound, stalled deals.',
    channels: 'Email + LinkedIn DM',
  },
  product_launch: {
    meaning: 'Drive launch-day awareness, demos, and first conversions. Best when you have a new product, feature, or release with a clear go-live date.',
    channels: 'LinkedIn Post + Twitter + Email',
  },
}

const CHANNELS: Channel[] = [
  { key: 'linkedin_message', label: 'LinkedIn DM', sub: 'Personal 1:1 outreach', Icon: Briefcase },
  { key: 'linkedin_post', label: 'LinkedIn Post', sub: 'Organic thought leadership', Icon: Briefcase },
  { key: 'email', label: 'Email', sub: 'Cold or warm email', Icon: Mail },
  { key: 'cold_dm', label: 'Cold DM', sub: 'Twitter or Instagram DM', Icon: MessageSquare },
  { key: 'twitter', label: 'Twitter / X', sub: 'Social media post', Icon: AtSign },
]

// Recommended channel mix per campaign type. Auto-applied when the user picks a
// type in step 1, but they can still tick/untick freely in step 2.
const RECOMMENDED_CHANNELS: Record<string, string[]> = {
  awareness: ['linkedin_post', 'twitter'],
  lead_gen: ['email', 'linkedin_message', 'linkedin_post'],
  nurture: ['email', 'linkedin_message'],
  product_launch: ['linkedin_post', 'twitter', 'email'],
}

const RECOMMENDATION_RATIONALE: Record<string, string> = {
  awareness: 'Awareness campaigns need broadcast reach — LinkedIn Post and Twitter give you the widest organic surface.',
  lead_gen: 'Lead Gen converts via 1:1 outreach (Email + LinkedIn DM). Adding LinkedIn Post warms prospects before your DM lands.',
  nurture: 'Nurture works best in 1:1 channels because the prospect already knows you. Posts can feel like spam to your warm list.',
  product_launch: 'Product launches need broadcast on day-one (Post + Twitter) plus an Email blast to your warm list.',
}

interface GenerationJob {
  id: string
  asset_type: string
  output_url: string | null
  content_job_json: any
  status: string
}

interface Prospect {
  id: string
  first_name: string | null
  last_name: string | null
  job_title: string | null
  company_name: string | null
  icp_score: number | null
}

export default function NewCampaignPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [name, setName] = useState('')
  const [campaignType, setCampaignType] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [durationDays, setDurationDays] = useState<number>(14)
  const [workingDaysOnly, setWorkingDaysOnly] = useState<boolean>(true)

  // Step 2
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['linkedin_message', 'email'])
  // Tracks whether the user has manually edited channels. If they have, we stop
  // overwriting their choice when they go back and change campaign type.
  const [channelsManuallyEdited, setChannelsManuallyEdited] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<GenerationJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [signedThumbs, setSignedThumbs] = useState<Record<string, string>>({})

  // Step 3
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [prospectsLoading, setProspectsLoading] = useState(false)
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set())

  // Load recent jobs on step 2
  useEffect(() => {
    if (step !== 2) return
    setJobsLoading(true)
    supabase
      .from('generation_jobs')
      .select('id,asset_type,output_url,content_job_json,status')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(24)
      .then(async ({ data }) => {
        const rows = (data ?? []) as GenerationJob[]
        setJobs(rows)
        setJobsLoading(false)
        // Sign thumbnails for any image asset.
        const signed: Record<string, string> = {}
        await Promise.all(rows.map(async (j) => {
          if (!j.output_url) return
          if (j.output_url.startsWith('http')) { signed[j.id] = j.output_url; return }
          const path = j.output_url.replace(/^assets\//, '')
          const { data: s } = await supabase.storage.from('assets').createSignedUrl(path, 3600)
          if (s?.signedUrl) signed[j.id] = s.signedUrl
        }))
        setSignedThumbs(signed)
      })
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load prospects on step 3
  useEffect(() => {
    if (step !== 3) return
    setProspectsLoading(true)
    supabase
      .from('prospects')
      .select('id,first_name,last_name,job_title,company_name,icp_score')
      .order('icp_score', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setProspects((data ?? []) as Prospect[])
        setProspectsLoading(false)
      })
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleChannel(key: string) {
    setChannelsManuallyEdited(true)
    setSelectedChannels(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    )
  }

  // Auto-preselect channels whenever the user picks a campaign type in step 1,
  // unless they've already manually customised the selection in step 2.
  useEffect(() => {
    if (!campaignType) return
    if (channelsManuallyEdited) return
    const rec = RECOMMENDED_CHANNELS[campaignType]
    if (rec && rec.length) setSelectedChannels(rec)
  }, [campaignType, channelsManuallyEdited])

  function toggleProspect(id: string) {
    setSelectedProspectIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleFinish() {
    if (!name.trim() || !campaignType) return
    setSaving(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

      // Create campaign
      const createRes = await fetch(`${supabaseUrl}/functions/v1/create-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          name: name.trim(),
          campaign_type: campaignType,
          description: description.trim() || undefined,
          channel_mix: selectedChannels,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          job_id: selectedJobId || undefined,
          duration_days: durationDays,
          working_days_only: workingDaysOnly,
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to create campaign')
      }

      const { campaign_id } = await createRes.json()

      // Add prospects if selected
      if (selectedProspectIds.size > 0) {
        await fetch(`${supabaseUrl}/functions/v1/add-campaign-prospects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ campaign_id, prospect_ids: Array.from(selectedProspectIds) }),
        })
      }

      router.push(`/campaigns/${campaign_id}`)
    } catch (e: any) {
      setError(e.message ?? 'Unexpected error')
      setSaving(false)
    }
  }

  const canAdvanceStep1 = name.trim().length > 0 && campaignType !== null
  const canAdvanceStep2 = selectedChannels.length > 0

  return (
    <div className="min-h-screen text-slate-100">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-10">

        <BackButton href="/campaigns" label="Back to campaigns" />

        {/* Progress */}
        <div className="flex items-center gap-3 mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                s < step ? 'bg-indigo-600 border-indigo-500 text-white' :
                s === step ? 'bg-slate-800 border-indigo-500 text-indigo-400' :
                'bg-slate-900 border-slate-700 text-slate-600'
              }`}>
                {s < step ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={`h-px flex-1 min-w-[40px] transition-colors ${s < step ? 'bg-indigo-600' : 'bg-slate-800'}`} />}
            </div>
          ))}
          <span className="ml-2 text-sm text-slate-400">Step {step} of 3</span>
        </div>

        {/* Step 1 — Campaign basics */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white">Campaign basics</h2>
              <p className="text-slate-400 text-sm mt-1">Name your campaign and choose its type.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Campaign name *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value.slice(0, 120))}
                placeholder="e.g. Q3 AI Thought Leadership"
                maxLength={120}
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600"
              />
              <p className="text-xs text-slate-600">{name.length}/120</p>
            </div>

            <div className="space-y-3">
              <Label className="text-slate-300">Campaign type * <span className="text-slate-600 text-xs">(hover the i for details)</span></Label>
              <div className="grid grid-cols-2 gap-3">
                {CAMPAIGN_TYPES.map(({ key, label, sub, Icon }) => {
                  const detail = CAMPAIGN_TYPE_DETAILS[key]
                  return (
                  <div key={key} className="relative group">
                    <button
                      onClick={() => setCampaignType(key)}
                      className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                        campaignType === key
                          ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/30'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${campaignType === key ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <div className="min-w-0">
                        <div className="font-medium text-white text-sm">{label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
                      </div>
                    </button>
                    {detail && (
                      <div className="absolute top-2 right-2">
                        <Info className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-300 cursor-help" />
                        <div className="pointer-events-none invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-5 z-20 w-64 p-3 rounded-lg border border-slate-700 bg-slate-950 shadow-xl text-left">
                          <div className="text-xs font-semibold text-white mb-1">{label}</div>
                          <div className="text-xs text-slate-300 leading-relaxed mb-2">{detail.meaning}</div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">Pre-selected channels</div>
                          <div className="text-xs text-indigo-300">{detail.channels}</div>
                        </div>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-300">Description <span className="text-slate-600 text-xs">(optional)</span></Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 500))}
                placeholder="Internal notes about this campaign..."
                rows={3}
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start" className="text-slate-300">Start date <span className="text-slate-600 text-xs">(optional)</span></Label>
                <Input id="start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end" className="text-slate-300">End date <span className="text-slate-600 text-xs">(optional)</span></Label>
                <Input id="end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white" />
              </div>
            </div>

            {/* Campaign length */}
            <div className="space-y-2">
              <Label className="text-slate-300">Campaign length</Label>
              <div className="flex flex-wrap gap-2">
                {[7, 14, 21, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDurationDays(d)}
                    className={`px-3 h-9 rounded-lg text-sm font-medium border transition-colors ${
                      durationDays === d
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {d} days
                  </button>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={[7, 14, 21, 30].includes(durationDays) ? '' : durationDays}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      if (Number.isFinite(v) && v >= 1 && v <= 90) setDurationDays(v)
                    }}
                    placeholder="Custom"
                    className="w-24 h-9 bg-slate-900 border-slate-700 text-white"
                  />
                  <span className="text-xs text-slate-500">days (1-90)</span>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-2 text-sm text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={workingDaysOnly}
                  onChange={(e) => setWorkingDaysOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                />
                Working days only (skip weekends)
              </label>
            </div>
          </div>
        )}

        {/* Step 2 — Channel mix and asset */}
        {step === 2 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white">Channels & asset</h2>
              <p className="text-slate-400 text-sm mt-1">Choose where you will publish and link a creative asset.</p>
            </div>

            <div className="space-y-3">
              <Label className="text-slate-300">Channel mix * <span className="text-slate-600 text-xs">(select all that apply)</span></Label>
              {campaignType && RECOMMENDATION_RATIONALE[campaignType] && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-indigo-900/50 bg-indigo-950/30 text-xs text-indigo-200">
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-400" />
                  <span><span className="font-medium">Pre-selected for {CAMPAIGN_TYPES.find(t => t.key === campaignType)?.label}.</span> {RECOMMENDATION_RATIONALE[campaignType]} You can change this.</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {CHANNELS.map(({ key, label, sub, Icon }) => {
                  const selected = selectedChannels.includes(key)
                  const recommended = campaignType ? (RECOMMENDED_CHANNELS[campaignType] ?? []).includes(key) : false
                  return (
                    <button
                      key={key}
                      onClick={() => toggleChannel(key)}
                      className={`relative flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/30'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                      }`}
                    >
                      {recommended && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Recommended</span>
                      )}
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${selected ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="font-medium text-white text-sm">{label}</div>
                        <div className="text-xs text-slate-500">{sub}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <Label className="text-slate-300">Link a creative asset <span className="text-slate-600 text-xs">(optional)</span></Label>
                {!jobsLoading && jobs.length > 0 && (
                  <span className="text-xs text-slate-500">Showing {jobs.length} most recent · <a href="/create" className="text-indigo-400 hover:text-indigo-300">view all</a></span>
                )}
              </div>
              {jobsLoading ? (
                <div className="grid grid-cols-4 gap-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg bg-slate-800" />)}
                </div>
              ) : jobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 py-8 text-center">
                  <ImageIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No assets yet.</p>
                  <a href="/create" className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 block">Create an asset →</a>
                </div>
              ) : (
                <div className={`grid grid-cols-4 gap-3 ${jobs.length > 8 ? 'max-h-[420px] overflow-y-auto pr-1' : ''}`}>
                  {jobs.map((job, idx) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id === selectedJobId ? null : job.id)}
                      className={`relative rounded-lg border overflow-hidden aspect-square transition-all ${
                        selectedJobId === job.id
                          ? 'border-indigo-500 ring-2 ring-indigo-500/40'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-950/80 text-slate-200 border border-slate-700 backdrop-blur-sm">#{idx + 1}</span>
                      {job.output_url && signedThumbs[job.id] ? (
                        job.asset_type === 'video' ? (
                          <video src={signedThumbs[job.id]} className="w-full h-full object-cover" muted playsInline />
                        ) : (
                          <img src={signedThumbs[job.id]} alt={`Asset #${idx + 1}`} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-slate-600" />
                        </div>
                      )}
                      {selectedJobId === job.id && (
                        <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-indigo-300" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Add prospects */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Add prospects</h2>
              <p className="text-slate-400 text-sm mt-1">Select which prospects to include. You can add more later.</p>
            </div>

            {prospectsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg bg-slate-800" />)}
              </div>
            ) : prospects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 py-10 text-center">
                <p className="text-slate-400 text-sm">No prospects yet.</p>
                <a href="/icp" className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 block">Run ICP enrichment to find prospects →</a>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{selectedProspectIds.size} selected</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedProspectIds(new Set(prospects.map(p => p.id)))}
                      className="text-xs text-indigo-400 hover:text-indigo-300">Select all</button>
                    <span className="text-slate-700">·</span>
                    <button onClick={() => setSelectedProspectIds(new Set())}
                      className="text-xs text-slate-400 hover:text-slate-300">Clear</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {prospects.map(p => {
                    const selected = selectedProspectIds.has(p.id)
                    const score = p.icp_score
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleProspect(p.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                          selected
                            ? 'border-indigo-500/50 bg-indigo-950/30'
                            : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          selected ? 'bg-indigo-600 border-indigo-500' : 'border-slate-600'
                        }`}>
                          {selected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-white">
                            {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unnamed'}
                          </span>
                          {p.job_title && <span className="text-slate-400 text-xs"> · {p.job_title}</span>}
                          {p.company_name && <span className="text-slate-500 text-xs"> at {p.company_name}</span>}
                        </div>
                        {score !== null && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            score >= 0.7 ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' :
                            score >= 0.4 ? 'bg-amber-900/30 border-amber-700/40 text-amber-300' :
                            'bg-slate-800 border-slate-700 text-slate-400'
                          }`}>
                            {(score * 100).toFixed(0)}%
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-950/40 border border-red-800/50 px-4 py-3 flex items-center gap-2">
            <X className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-800">
          <button
            onClick={() => step > 1 ? setStep(s => (s - 1) as Step) : router.back()}
            className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => (s + 1) as Step)}
              disabled={step === 1 ? !canAdvanceStep1 : !canAdvanceStep2}
              className="flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? 'Creating…' : 'Create Campaign'}
            </button>
          )}
        </div>

        {/* Skip prospects link */}
        {step === 3 && !saving && (
          <div className="text-center mt-2">
            <button onClick={handleFinish} className="text-xs text-slate-500 hover:text-slate-400 underline underline-offset-2">
              Skip for now — add prospects later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
