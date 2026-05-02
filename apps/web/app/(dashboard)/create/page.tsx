'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Camera, Pencil, Triangle, Box, LayoutGrid,
  ImageIcon, Video, Globe, Download, RefreshCw,
  Target, Wand2, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  Loader2, Code2, X, ExternalLink, AlertCircle, Sparkles,
} from 'lucide-react'
import { REFINEMENT_CHIP_MAP, STRENGTH_INSTRUCTIONS } from '@/lib/refinement-chips'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

type PromptTags = {
  subject: string; visual_style: string; mood: string; colour_palette: string
  platform: string; aspect_ratio: string; cta_text: string
  negative_prompt: string; additional_notes: string
}
type AssetType = 'image' | 'video'
type Model = {
  model_id: string; provider_key: string; model_label: string; model_type: string
  cost_tier: string | null; estimated_time_seconds: number | null
  requires_paid_plan: boolean; key_source: string; org_has_key: boolean
  default_for_step_key: string[] | null
}
type BrandColours = { primary?: string; secondary?: string; accent?: string }
type BrandContext = {
  company_name: string | null; brand_colours: BrandColours | null
  active_themes: string[] | null; decision_maker_titles: string[] | null
  topics_to_avoid: string[] | null; phrases_to_avoid: string[] | null
  visual_styles_to_avoid: string[] | null; voice_examples: string[] | null
}

const DEFAULT_TAGS: PromptTags = {
  subject: '', visual_style: 'photography', mood: 'professional', colour_palette: '',
  platform: 'linkedin', aspect_ratio: '1:1', cta_text: '', negative_prompt: '', additional_notes: '',
}

function SelectCard({ selected, onClick, children, disabled = false }: {
  selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean
}) {
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled}
      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-all cursor-pointer select-none
        ${selected ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-950' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      {children}
    </button>
  )
}

const VISUAL_STYLES = [
  { value: 'photography', label: 'Photography', Icon: Camera },
  { value: 'illustration', label: 'Illustration', Icon: Pencil },
  { value: 'abstract', label: 'Abstract', Icon: Triangle },
  { value: '3d', label: '3D Render', Icon: Box },
  { value: 'flat', label: 'Flat Design', Icon: LayoutGrid },
]
const MOODS = [
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'bold', label: 'Bold', emoji: '⚡' },
  { value: 'calm', label: 'Calm', emoji: '🌿' },
  { value: 'energetic', label: 'Energetic', emoji: '🚀' },
  { value: 'minimal', label: 'Minimal', emoji: '◻️' },
  { value: 'warm', label: 'Warm', emoji: '☀️' },
]
const PLATFORMS = [
  { value: 'linkedin', label: 'LinkedIn', sub: 'Square · 4:5', ratio: '4:5' },
  { value: 'instagram', label: 'Instagram', sub: 'Square or Story', ratio: '1:1' },
  { value: 'twitter', label: 'Twitter / X', sub: 'Landscape 16:9', ratio: '16:9' },
  { value: 'whatsapp', label: 'WhatsApp', sub: 'Square · 1:1', ratio: '1:1' },
  { value: 'generic', label: 'Generic', sub: 'Any format', ratio: '1:1' },
]
const RATIOS = [
  { value: '1:1', label: 'Square', w: 40, h: 40 },
  { value: '16:9', label: 'Landscape', w: 56, h: 32 },
  { value: '9:16', label: 'Portrait/Story', w: 28, h: 48 },
  { value: '4:5', label: 'Portrait Feed', w: 36, h: 44 },
]

function RefinementPanel({ open, onClose, originalJobId, originalTags, originalImageUrl, onRefined }: {
  open: boolean; onClose: () => void; originalJobId: string; originalTags: PromptTags
  originalImageUrl: string; onRefined: (jobId: string, url: string) => void
}) {
  const [chips, setChips] = useState<string[]>([])
  const [strength, setStrength] = useState(2)
  const [keepColours, setKeepColours] = useState(true)
  const [keepSubject, setKeepSubject] = useState(true)
  const [customText, setCustomText] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [refinedUrl, setRefinedUrl] = useState<string | null>(null)
  const [refinedJobId, setRefinedJobId] = useState<string | null>(null)
  const [refineError, setRefineError] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  function toggleChip(chip: string) {
    setChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip])
  }

  async function applyRefinements() {
    if (chips.length === 0 && !customText.trim()) return
    setIsRefining(true); setRefineError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
      const chipInstructions = chips.map(c => REFINEMENT_CHIP_MAP[c] ?? c).join(' ')
      const strengthNote = (STRENGTH_INSTRUCTIONS[strength] ?? '').replace('[chips selected]', chips.join(', '))
      const refinedTags: PromptTags = { ...originalTags, additional_notes: [chipInstructions, customText.trim(), strengthNote, keepColours ? 'Keep the brand colours.' : '', keepSubject ? 'Keep the main subject/element.' : ''].filter(Boolean).join(' ') }
      const buildRes = await fetch(`${SUPABASE_URL}/functions/v1/build-prompt`, { method: 'POST', headers, body: JSON.stringify({ prompt_tags: refinedTags }) })
      if (!buildRes.ok) throw new Error('Failed to build refined prompt')
      const { content_job } = await buildRes.json()
      const genRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-asset`, { method: 'POST', headers, body: JSON.stringify({ content_job, parent_job_id: originalJobId }) })
      if (!genRes.ok) { const err = await genRes.json(); throw new Error(err.error ?? 'Generation failed') }
      const genData = await genRes.json()
      if (genData.status === 'completed' && genData.output_url) { setRefinedUrl(genData.output_url); setRefinedJobId(genData.job_id) }
    } catch (err: any) { setRefineError(err.message ?? 'Refinement failed') }
    finally { setIsRefining(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-xl bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2"><Wand2 className="w-4 h-4 text-indigo-400" /><h2 className="text-base font-semibold text-slate-100">Refine Image</h2></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 flex-1 space-y-5">
          {refinedUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Compare your results:</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 text-center">Original</p>
                  <img src={originalImageUrl} alt="Original" className="w-full rounded-lg border border-slate-700 object-cover" />
                  <Button variant="outline" size="sm" className="w-full border-slate-700 text-slate-300" onClick={onClose}>Keep original</Button>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 text-center">Refined</p>
                  <img src={refinedUrl} alt="Refined" className="w-full rounded-lg border border-indigo-500/30 object-cover" />
                  <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-500" onClick={() => { if (refinedJobId) onRefined(refinedJobId, refinedUrl); onClose() }}>Use refined</Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => { setRefinedUrl(null); setRefinedJobId(null); setChips([]) }}>Refine again</Button>
            </div>
          ) : (
            <>
              <img src={originalImageUrl} alt="Current" className="w-full rounded-lg border border-slate-700 object-cover" />
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-400">What to fix</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(REFINEMENT_CHIP_MAP).map(chip => (
                    <button key={chip} type="button" onClick={() => toggleChip(chip)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all ${chips.includes(chip) ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'}`}>
                      {chip}
                    </button>
                  ))}
                  <button type="button" onClick={() => setCustomText(t => t || ' ')} className="px-3 py-1.5 rounded-full text-xs border border-dashed border-slate-600 text-slate-500 hover:border-slate-500">Something else…</button>
                </div>
                {customText !== '' && <Input value={customText} onChange={e => setCustomText(e.target.value)} placeholder="Describe what to change…" className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm mt-2" />}
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium text-slate-400">How different from the original?</Label>
                  <span className="text-xs text-indigo-400">{strength}/5</span>
                </div>
                <Slider min={1} max={5} step={1} value={[strength]} onValueChange={(v: number | readonly number[]) => setStrength(Array.isArray(v) ? (v as number[])[0] : (v as number))} className="py-1" />
                <div className="flex justify-between text-xs text-slate-500"><span>Small tweak</span><span>Completely new</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SelectCard selected={keepColours} onClick={() => setKeepColours(v => !v)}><span className="text-xs text-slate-300 text-center leading-tight">Keep my<br />brand colours</span></SelectCard>
                <SelectCard selected={keepSubject} onClick={() => setKeepSubject(v => !v)}><span className="text-xs text-slate-300 text-center leading-tight">Keep the<br />main subject</span></SelectCard>
              </div>
              {refineError && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" />{refineError}</p>}
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500" disabled={isRefining || (chips.length === 0 && !customText.trim())} onClick={applyRefinements}>
                {isRefining ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Refining…</> : 'Apply refinements'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CreatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const signalId = searchParams.get('signal_id')

  const [tags, setTags] = useState<PromptTags>(DEFAULT_TAGS)
  const [assetType, setAssetType] = useState<AssetType>('image')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [showBrandPanel, setShowBrandPanel] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedProviderKey, setSelectedProviderKey] = useState('')
  const [brand, setBrand] = useState<BrandContext | null>(null)
  const [quotaUsed, setQuotaUsed] = useState(0)
  const [quotaMax, setQuotaMax] = useState(50)
  const [videoQuotaUsed, setVideoQuotaUsed] = useState(0)
  const [videoQuotaMax, setVideoQuotaMax] = useState(5)
  const [signalHeadline, setSignalHeadline] = useState<string | null>(null)
  const [signalBannerDismissed, setSignalBannerDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [generatedJobId, setGeneratedJobId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [showRefinement, setShowRefinement] = useState(false)

  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
      const [modelsRes, brandRes, quotaRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/functions/v1/get-available-models`, { headers }),
        supabase.from('brand_contexts').select('*').single(),
        fetch(`${SUPABASE_URL}/functions/v1/check-quota`, { headers }),
      ])
      if (modelsRes.ok) {
        const data = await modelsRes.json()
        setModels(data.models ?? [])
        const prefs: any[] = data.preferences ?? []
        const imgModels = (data.models ?? []).filter((m: Model) => m.model_type === 'image')
        const pref = prefs.find((p: any) => p.step_key === 'image_generation')
        const def = pref ? imgModels.find((m: Model) => m.model_id === pref.model_id) : imgModels.find((m: Model) => m.default_for_step_key?.includes('image_generation'))
        const first = def ?? imgModels[0]
        if (first) { setSelectedModelId(first.model_id); setSelectedProviderKey(first.provider_key) }
      }
      if (!brandRes.error && brandRes.data) {
        const b = brandRes.data as BrandContext; setBrand(b)
        const c = b.brand_colours
        if (c) { const p = [c.primary && `Primary: ${c.primary}`, c.secondary && `Secondary: ${c.secondary}`, c.accent && `Accent: ${c.accent}`].filter(Boolean).join(', '); if (p) setTags(prev => ({ ...prev, colour_palette: p })) }
        const neg = [...(b.topics_to_avoid ?? []), ...(b.phrases_to_avoid ?? []), ...(b.visual_styles_to_avoid ?? [])].join(', ')
        if (neg) setTags(prev => ({ ...prev, negative_prompt: neg }))
      }
      if (quotaRes.ok) { const q = await quotaRes.json(); setQuotaUsed(q.image_used ?? 0); setQuotaMax(q.image_quota ?? 50); setVideoQuotaUsed(q.video_used ?? 0); setVideoQuotaMax(q.video_quota ?? 5) }
    }
    load()
  }, [])

  useEffect(() => {
    if (!signalId) return
    supabase.from('signals').select('headline').eq('id', signalId).single().then(({ data }: { data: any }) => {
      if (data?.headline) { setSignalHeadline(data.headline); setTags(prev => ({ ...prev, subject: prev.subject || data.headline.slice(0, 200) })) }
    })
  }, [signalId])

  useEffect(() => { if (showJson) setJsonText(JSON.stringify({ signal_id: signalId, prompt_tags: tags }, null, 2)) }, [tags, showJson, signalId])

  useEffect(() => {
    const filtered = models.filter(m => m.model_type === assetType)
    if (!filtered.find(m => m.model_id === selectedModelId) && filtered.length > 0) {
      setSelectedModelId(filtered[0].model_id); setSelectedProviderKey(filtered[0].provider_key)
    }
  }, [assetType, models])

  function handleTagChange(key: keyof PromptTags, value: string) { setTags(prev => ({ ...prev, [key]: value })) }
  function handleJsonChange(text: string) {
    setJsonText(text)
    try { const p = JSON.parse(text); if (p.prompt_tags) setTags(prev => ({ ...prev, ...p.prompt_tags })) } catch {}
  }

  async function submitFeedback(thumb: 'up' | 'down') {
    if (!generatedJobId || feedback !== null) return
    setFeedback(thumb)
    const { data: { session } } = await supabase.auth.getSession(); if (!session) return
    await fetch(`${SUPABASE_URL}/functions/v1/submit-feedback`, {
      method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: generatedJobId, thumbs: thumb }),
    })
  }

  function handleGenerate() {
    if (!tags.subject.trim()) { setError('Subject is required'); return }
    if (!selectedModelId) { setError('No model available'); return }
    const over = assetType === 'image' ? quotaUsed >= quotaMax : videoQuotaUsed >= videoQuotaMax
    if (over) { setError(`${assetType === 'image' ? 'Image' : 'Video'} quota reached. Upgrade to continue.`); return }
    setError(null); setGeneratedImageUrl(null); setGeneratedJobId(null); setFeedback(null)
    startTransition(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession(); if (!session) return
        const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
        const buildRes = await fetch(`${SUPABASE_URL}/functions/v1/build-prompt`, { method: 'POST', headers, body: JSON.stringify({ signal_id: signalId, prompt_tags: { ...tags, asset_type: assetType } }) })
        if (!buildRes.ok) { const err = await buildRes.json(); setError(err.error ?? 'Failed to build prompt'); return }
        const { content_job } = await buildRes.json()
        content_job.model_id = selectedModelId; content_job.provider_key = selectedProviderKey; content_job.asset_type = assetType
        const genRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-asset`, { method: 'POST', headers, body: JSON.stringify({ content_job, model_id: selectedModelId, provider_key: selectedProviderKey }) })
        if (!genRes.ok) {
          const err = await genRes.json()
          if (err.error === 'quota_exceeded') setError('Quota reached. Upgrade to continue.')
          else if (err.error === 'model_requires_paid_plan') setError('This model requires a paid plan.')
          else setError(err.error ?? 'Generation failed'); return
        }
        const genData = await genRes.json()
        if (genData.status === 'completed' && genData.output_url) { setGeneratedImageUrl(genData.output_url); setGeneratedJobId(genData.job_id); setQuotaUsed(prev => prev + 1); return }
        if (genData.job_id && assetType === 'video') {
          const ch = supabase.channel(`job:${genData.job_id}`)
          ch.on('broadcast', { event: 'job_complete' }, ({ payload }: any) => router.push(`/create/${payload.job_id}`)).subscribe()
          router.push('/dashboard'); return
        }
        setGeneratedJobId(genData.job_id)
      } catch (err: any) { setError(err.message ?? 'Unexpected error') }
    })
  }

  const filteredModels = models.filter(m => m.model_type === assetType)
  const selectedModel = filteredModels.find(m => m.model_id === selectedModelId)
  const quotaRemaining = assetType === 'image' ? quotaMax - quotaUsed : videoQuotaMax - videoQuotaUsed

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Create Asset</h1>
            <p className="text-slate-400 mt-1 text-sm">AI-powered GTM content, guided by your brand.</p>
          </div>
          <div className="text-right text-xs mt-1 space-x-3">
            <span className={quotaUsed >= quotaMax ? 'text-red-400' : 'text-slate-500'}>Images: {quotaUsed}/{quotaMax}</span>
            <span className={videoQuotaUsed >= videoQuotaMax ? 'text-red-400' : 'text-slate-500'}>Videos: {videoQuotaUsed}/{videoQuotaMax}</span>
          </div>
        </div>

        {/* Signal context banner */}
        {signalId && signalHeadline && !signalBannerDismissed && (
          <div className="mb-4 flex items-center justify-between bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-indigo-300 min-w-0">
              <span className="shrink-0">📰 Based on:</span>
              <span className="truncate font-medium">{signalHeadline.slice(0, 80)}{signalHeadline.length > 80 ? '…' : ''}</span>
              <a href={`/dashboard/signal/${signalId}`} className="shrink-0 flex items-center gap-1 text-indigo-400 hover:text-indigo-300 ml-1">
                View <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <button onClick={() => setSignalBannerDismissed(true)} className="ml-3 text-slate-500 hover:text-slate-300 shrink-0"><X className="w-4 h-4" /></button>
          </div>
        )}

        {assetType === 'video' && (
          <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-300">
            <Video className="w-4 h-4 shrink-0" />
            Video jobs run in the background. You will get a notification when it is ready.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column — tag card editor */}
          <div className="lg:col-span-3 space-y-4">

            {/* Subject */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <Label className="text-sm font-medium text-slate-400">What is this image/video about? <span className="text-red-400">*</span></Label>
              <Input value={tags.subject} onChange={e => handleTagChange('subject', e.target.value)} placeholder="e.g. AI is changing the way financial teams work" maxLength={200} className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500" />
              <div className="text-right text-xs text-slate-600">{tags.subject.length}/200</div>
            </div>

            {/* Visual Style */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <Label className="text-sm font-medium text-slate-400">Visual Style</Label>
              <div className="grid grid-cols-5 gap-2">
                {VISUAL_STYLES.map(({ value, label, Icon }) => (
                  <SelectCard key={value} selected={tags.visual_style === value} onClick={() => handleTagChange('visual_style', value)}>
                    <Icon className="w-5 h-5 text-slate-300" />
                    <span className="text-xs text-slate-300 leading-tight">{label}</span>
                  </SelectCard>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <Label className="text-sm font-medium text-slate-400">Mood</Label>
              <div className="grid grid-cols-3 gap-2">
                {MOODS.map(({ value, label, emoji }) => (
                  <SelectCard key={value} selected={tags.mood === value} onClick={() => handleTagChange('mood', value)}>
                    <span className="text-xl">{emoji}</span>
                    <span className="text-xs text-slate-300">{label}</span>
                  </SelectCard>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <Label className="text-sm font-medium text-slate-400">Platform</Label>
              <div className="grid grid-cols-5 gap-2">
                {PLATFORMS.map(({ value, label, sub, ratio }) => (
                  <SelectCard key={value} selected={tags.platform === value} onClick={() => { handleTagChange('platform', value); handleTagChange('aspect_ratio', ratio) }}>
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-300 font-medium leading-tight">{label}</span>
                    <span className="text-[10px] text-slate-500 leading-tight">{sub}</span>
                  </SelectCard>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <Label className="text-sm font-medium text-slate-400">Aspect Ratio</Label>
              <div className="grid grid-cols-4 gap-2">
                {RATIOS.map(({ value, label, w, h }) => (
                  <SelectCard key={value} selected={tags.aspect_ratio === value} onClick={() => handleTagChange('aspect_ratio', value)}>
                    <svg width={w} height={h}>
                      <rect x={1} y={1} width={w - 2} height={h - 2} rx={2} className="fill-slate-700 stroke-slate-500" strokeWidth={1.5} />
                    </svg>
                    <span className="text-[11px] text-slate-300 leading-tight">{label}</span>
                    <span className="text-[10px] text-slate-500">{value}</span>
                  </SelectCard>
                ))}
              </div>
            </div>

            {/* Colour Palette */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <Label className="text-sm font-medium text-slate-400">Colour Palette</Label>
              <ColourPaletteCards value={tags.colour_palette} onChange={v => handleTagChange('colour_palette', v)} brandColours={brand?.brand_colours ?? null} />
            </div>

            {/* CTA */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <Label className="text-sm font-medium text-slate-400">Call to action overlay <span className="text-slate-600 font-normal">(optional)</span></Label>
              <Input value={tags.cta_text} onChange={e => handleTagChange('cta_text', e.target.value)} placeholder="e.g. Book a free demo →" maxLength={80} className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500" />
            </div>

            {/* Advanced */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button type="button" onClick={() => setShowAdvanced(v => !v)} className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 transition-colors">
                <span>Advanced options</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showAdvanced && (
                <div className="px-5 pb-5 space-y-4 border-t border-slate-800 pt-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-400">Exclude from image <span className="text-slate-600 font-normal">— Things you do not want to appear</span></Label>
                    <Textarea value={tags.negative_prompt} onChange={e => handleTagChange('negative_prompt', e.target.value)} placeholder="e.g. people, red colours, busy backgrounds" rows={2} maxLength={500} className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-400">Anything else to tell the AI</Label>
                    <Textarea value={tags.additional_notes} onChange={e => handleTagChange('additional_notes', e.target.value)} placeholder="Any additional context or instructions…" rows={2} maxLength={500} className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none" />
                    <div className="text-right text-xs text-slate-600">{tags.additional_notes.length}/500</div>
                  </div>
                  <div>
                    <button type="button" onClick={() => setShowJson(v => !v)} className="text-xs text-slate-500 hover:text-indigo-400 flex items-center gap-1">
                      <Code2 className="w-3 h-3" />{showJson ? 'Hide' : 'View'} full JSON
                    </button>
                    {showJson && <Textarea value={jsonText} onChange={e => handleJsonChange(e.target.value)} rows={10} className="mt-2 bg-slate-950 border-slate-700 text-slate-300 font-mono text-xs resize-none" />}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column — brand context + model + generate */}
          <div className="lg:col-span-2 space-y-4">

            {/* Brand context accordion */}
            {brand && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setShowBrandPanel(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-2 text-emerald-400"><Sparkles className="w-4 h-4" /><span className="font-medium">Your brand context is included ✓</span></div>
                  {showBrandPanel ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {showBrandPanel && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
                    {brand.brand_colours && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Brand colours</p>
                        <div className="flex gap-2">{[brand.brand_colours.primary, brand.brand_colours.secondary, brand.brand_colours.accent].filter(Boolean).map((c, i) => <span key={i} className="w-6 h-6 rounded-full border border-slate-600" style={{ backgroundColor: c }} />)}</div>
                      </div>
                    )}
                    {brand.active_themes && brand.active_themes.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Active themes</p>
                        <div className="flex flex-wrap gap-1">{brand.active_themes.map((t, i) => <span key={i} className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded text-xs">{t}</span>)}</div>
                      </div>
                    )}
                    {brand.voice_examples?.[0] && <div><p className="text-xs text-slate-500 mb-1">Voice example</p><p className="text-xs text-slate-400 line-clamp-2">{brand.voice_examples[0].slice(0, 100)}…</p></div>}
                  </div>
                )}
              </div>
            )}

            {/* Asset type */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <Label className="text-sm font-medium text-slate-400">Asset type</Label>
              <div className="grid grid-cols-2 gap-3">
                <SelectCard selected={assetType === 'image'} onClick={() => setAssetType('image')}>
                  <ImageIcon className="w-6 h-6 text-slate-300" /><span className="text-sm font-medium text-slate-200">Image</span><span className="text-xs text-slate-500">Ready in ~20s</span>
                </SelectCard>
                <SelectCard selected={assetType === 'video'} onClick={() => setAssetType('video')}>
                  <Video className="w-6 h-6 text-slate-300" /><span className="text-sm font-medium text-slate-200">Video</span><span className="text-xs text-slate-500">Ready in 2–5 min</span>
                </SelectCard>
              </div>
            </div>

            {/* Model selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <Label className="text-sm font-medium text-slate-400">AI Model</Label>
              {filteredModels.length === 0 ? (
                <p className="text-sm text-slate-500 py-1">No {assetType} models available.</p>
              ) : (
                <select value={selectedModelId} onChange={e => { const m = filteredModels.find(x => x.model_id === e.target.value); if (m) { setSelectedModelId(m.model_id); setSelectedProviderKey(m.provider_key) } }} className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {filteredModels.map(m => <option key={m.model_id} value={m.model_id}>{m.model_label}{m.default_for_step_key?.some(s => s.includes(assetType)) ? ' ★' : ''}</option>)}
                </select>
              )}
              {selectedModel && <p className="text-xs text-slate-500">{selectedModel.estimated_time_seconds ? `~${selectedModel.estimated_time_seconds}s · ` : ''}{selectedModel.cost_tier ?? ''}{selectedModel.org_has_key ? ' · Your key' : ' · Platform key'}</p>}
              <a href="/settings/models" className="text-xs text-slate-500 hover:text-indigo-400 underline underline-offset-2">Change default in Settings</a>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}

            {/* Generate button */}
            <div className="sticky bottom-4 lg:static">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 text-base" disabled={isPending || !tags.subject.trim() || filteredModels.length === 0} onClick={handleGenerate}>
                {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{assetType === 'video' ? 'Submitting…' : 'Generating…'}</> : `Generate ${assetType === 'image' ? 'Image' : 'Video'}`}
              </Button>
              <p className="text-center text-xs text-slate-600 mt-2">{quotaRemaining} {assetType}{quotaRemaining !== 1 ? 's' : ''} remaining this month</p>
            </div>

            {/* Generation in progress */}
            {isPending && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-sm text-slate-300 font-medium">{assetType === 'video' ? 'Submitting video job…' : 'Generating your image…'}</p>
                {assetType === 'image' && <p className="text-xs text-slate-500 italic animate-pulse">"{tags.subject.slice(0, 60)}{tags.subject.length > 60 ? '…' : ''}"</p>}
              </div>
            )}

            {/* Inline image result */}
            {generatedImageUrl && generatedJobId && !isPending && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <img src={generatedImageUrl} alt="Generated asset" className="w-full rounded-lg border border-slate-700 object-cover" />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => { const a = document.createElement('a'); a.href = generatedImageUrl; a.download = `gtm-${generatedJobId.slice(0, 8)}.png`; a.click() }}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />Download
                  </Button>
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setShowRefinement(true)}>
                    <Wand2 className="w-3.5 h-3.5 mr-1.5" />Refine
                  </Button>
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => router.push(`/icp?job_id=${generatedJobId}`)}>
                    <Target className="w-3.5 h-3.5 mr-1.5" />For campaign
                  </Button>
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => { setGeneratedImageUrl(null); setGeneratedJobId(null); setFeedback(null); handleGenerate() }}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Regenerate
                  </Button>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <span className="text-xs text-slate-500">Was this image good?</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => submitFeedback('up')} disabled={feedback !== null} className={`p-1.5 rounded transition-colors ${feedback === 'up' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}><ThumbsUp className="w-4 h-4" /></button>
                    <button type="button" onClick={() => submitFeedback('down')} disabled={feedback !== null} className={`p-1.5 rounded transition-colors ${feedback === 'down' ? 'text-red-400' : 'text-slate-500 hover:text-slate-300'}`}><ThumbsDown className="w-4 h-4" /></button>
                    <button type="button" onClick={() => router.push(`/create/${generatedJobId}`)} className="text-xs text-slate-500 hover:text-indigo-400 ml-2">Full view →</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {generatedImageUrl && generatedJobId && (
        <RefinementPanel open={showRefinement} onClose={() => setShowRefinement(false)} originalJobId={generatedJobId} originalTags={tags} originalImageUrl={generatedImageUrl}
          onRefined={(newJobId, newUrl) => { setGeneratedImageUrl(newUrl); setGeneratedJobId(newJobId); setFeedback(null) }} />
      )}
    </div>
  )
}

function ColourPaletteCards({ value, onChange, brandColours }: { value: string; onChange: (v: string) => void; brandColours: BrandColours | null }) {
  const [showCustom, setShowCustom] = useState(false)
  const brandPalette = brandColours ? [brandColours.primary, brandColours.secondary, brandColours.accent].filter(Boolean).join(', ') : ''
  const presets = [
    { key: 'brand', label: 'Brand colours', swatches: [brandColours?.primary ?? '#4f46e5', brandColours?.secondary ?? '#1e293b', brandColours?.accent ?? '#06b6d4'], palette: brandPalette || 'brand colours' },
    { key: 'vibrant', label: 'Vibrant', swatches: ['#f59e0b', '#ef4444', '#10b981'], palette: 'vibrant, high-saturation, energetic colours' },
    { key: 'mono', label: 'Monochrome', swatches: ['#f8fafc', '#94a3b8', '#0f172a'], palette: 'monochrome, black and white, greyscale' },
  ]
  const selectedKey = presets.find(p => p.palette === value)?.key ?? (value ? 'custom' : 'brand')
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {presets.map(({ key, label, swatches, palette }) => (
          <SelectCard key={key} selected={selectedKey === key} onClick={() => { onChange(palette); setShowCustom(false) }}>
            <div className="flex gap-1">{swatches.map((c, i) => <span key={i} className="w-5 h-5 rounded-full border border-slate-600 shrink-0" style={{ backgroundColor: c as string }} />)}</div>
            <span className="text-xs text-slate-300">{label}</span>
          </SelectCard>
        ))}
      </div>
      <button type="button" className="text-xs text-slate-400 hover:text-indigo-400 underline underline-offset-2" onClick={() => setShowCustom(v => !v)}>Custom…</button>
      {showCustom && <Input value={value} onChange={e => onChange(e.target.value)} placeholder="e.g. deep navy, electric blue, white" className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm" />}
    </div>
  )
}
