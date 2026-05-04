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
  ArrowLeft, ArrowRight, Image as ImageIcon, Loader2, X,
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

const CHANNELS: Channel[] = [
  { key: 'linkedin_message', label: 'LinkedIn DM', sub: 'Personal 1:1 outreach', Icon: Briefcase },
  { key: 'linkedin_post', label: 'LinkedIn Post', sub: 'Organic thought leadership', Icon: Briefcase },
  { key: 'email', label: 'Email', sub: 'Cold or warm email', Icon: Mail },
  { key: 'cold_dm', label: 'Cold DM', sub: 'Twitter or Instagram DM', Icon: MessageSquare },
  { key: 'twitter', label: 'Twitter / X', sub: 'Social media post', Icon: AtSign },
]

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

  // Step 2
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['linkedin_message', 'email'])
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
      .limit(8)
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
    setSelectedChannels(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    )
  }

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
      <div className="max-w-2xl mx-auto px-6 py-10">

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
              <Label className="text-slate-300">Campaign type *</Label>
              <div className="grid grid-cols-2 gap-3">
                {CAMPAIGN_TYPES.map(({ key, label, sub, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setCampaignType(key)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                      campaignType === key
                        ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/30'
                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${campaignType === key ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <div>
                      <div className="font-medium text-white text-sm">{label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
                    </div>
                  </button>
                ))}
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
              <div className="grid grid-cols-2 gap-3">
                {CHANNELS.map(({ key, label, sub, Icon }) => {
                  const selected = selectedChannels.includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleChannel(key)}
                      className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/30'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                      }`}
                    >
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
              <Label className="text-slate-300">Link a creative asset <span className="text-slate-600 text-xs">(optional)</span></Label>
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
                <div className="grid grid-cols-4 gap-3">
                  {jobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id === selectedJobId ? null : job.id)}
                      className={`relative rounded-lg border overflow-hidden aspect-square transition-all ${
                        selectedJobId === job.id
                          ? 'border-indigo-500 ring-2 ring-indigo-500/40'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {job.output_url && signedThumbs[job.id] ? (
                        job.asset_type === 'video' ? (
                          <video src={signedThumbs[job.id]} className="w-full h-full object-cover" muted playsInline />
                        ) : (
                          <img src={signedThumbs[job.id]} alt="" className="w-full h-full object-cover" />
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
