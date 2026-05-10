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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { BackButton } from '@/components/layout/back-button'
import { SocialCopySection } from '@/components/generation/social-copy-section'

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
  platform: 'linkedin', aspect_ratio: '4:5', cta_text: '', negative_prompt: '', additional_notes: '',
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
  { value: 'linkedin', label: 'LinkedIn', sub: 'Portrait · 4:5', ratio: '4:5' },
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
  type RefinementOption = { id: string; option_type: 'chip' | 'strength' | 'toggle'; option_key: string; label: string; instruction_text: string; position: number; org_id: string | null }
  const [options, setOptions] = useState<RefinementOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [chipKeys, setChipKeys] = useState<string[]>([])
  const [strength, setStrength] = useState(2)
  const [toggleKeys, setToggleKeys] = useState<Set<string>>(new Set(['keep_colours', 'keep_subject']))
  const [customText, setCustomText] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [refinedUrl, setRefinedUrl] = useState<string | null>(null)
  const [refinedJobId, setRefinedJobId] = useState<string | null>(null)
  const [refineError, setRefineError] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (!open) return
    let active = true
    ;(async () => {
      setLoadingOptions(true)
      const { data } = await supabase
        .from('refinement_options')
        .select('id, option_type, option_key, label, instruction_text, position, org_id')
        .eq('is_active', true)
        .order('position', { ascending: true })
      if (!active) return
      // Org rows override globals on (option_type, option_key)
      const merged = new Map<string, RefinementOption>()
      ;(data ?? []).forEach((row: any) => {
        const k = row.option_type + ':' + row.option_key
        const existing = merged.get(k)
        if (!existing || (existing.org_id === null && row.org_id !== null)) merged.set(k, row)
      })
      setOptions(Array.from(merged.values()).sort((a, b) => a.position - b.position))
      setLoadingOptions(false)
    })()
    return () => { active = false }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const chipOptions = options.filter(o => o.option_type === 'chip')
  const strengthOptions = options.filter(o => o.option_type === 'strength')
  const toggleOptions = options.filter(o => o.option_type === 'toggle')

  function toggleChip(key: string) {
    setChipKeys(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])
  }
  function toggleToggle(key: string) {
    setToggleKeys(prev => { const next = new Set(prev); if (next.has(key)) { next.delete(key) } else { next.add(key) } return next })
  }

  async function applyRefinements() {
    if (chipKeys.length === 0 && !customText.trim()) return
    setIsRefining(true); setRefineError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }

      const chipLookup = new Map(chipOptions.map(o => [o.option_key, o]))
      const strengthLookup = new Map(strengthOptions.map(o => [o.option_key, o]))
      const toggleLookup = new Map(toggleOptions.map(o => [o.option_key, o]))

      const chipInstructions = chipKeys.map(k => chipLookup.get(k)?.instruction_text ?? '').filter(Boolean).join(' ')
      const selectedChipLabels = chipKeys.map(k => chipLookup.get(k)?.label ?? k).join(', ')
      const strengthRow = strengthLookup.get('strength_' + strength)
      const strengthNote = (strengthRow?.instruction_text ?? '').replace('[chips selected]', selectedChipLabels)
      const toggleNotes = Array.from(toggleKeys).map(k => toggleLookup.get(k)?.instruction_text ?? '').filter(Boolean).join(' ')

      const refinedTags: PromptTags = {
        ...originalTags,
        additional_notes: [chipInstructions, customText.trim(), strengthNote, toggleNotes].filter(Boolean).join(' '),
      }

      const buildRes = await fetch(`${SUPABASE_URL}/functions/v1/build-prompt`, { method: 'POST', headers, body: JSON.stringify({ prompt_tags: refinedTags }) })
      if (!buildRes.ok) throw new Error('Failed to build refined prompt')
      const { content_job } = await buildRes.json()
      const genRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-asset`, { method: 'POST', headers, body: JSON.stringify({ content_job, parent_job_id: originalJobId }) })
      if (!genRes.ok) {
        const err = await genRes.json()
        const msg = err.retryable === true || genRes.status === 503 || genRes.status === 502
          ? (err.error ?? 'AI provider is temporarily unavailable. Your quota was not deducted — please try again.')
          : (err.error ?? 'Generation failed')
        throw new Error(msg)
      }
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
                  {loadingOptions ? (
                    <span className="text-xs text-slate-500">Loading options…</span>
                  ) : chipOptions.map(opt => (
                    <button key={opt.option_key} type="button" onClick={() => toggleChip(opt.option_key)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all ${chipKeys.includes(opt.option_key) ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'}`}>
                      {opt.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => setCustomText(t => t || ' ')} className="px-3 py-1.5 rounded-full text-xs border border-dashed border-slate-600 text-slate-300 hover:border-slate-400 hover:text-slate-100">+ Type your own</button>
                </div>
                {customText !== '' && <Input value={customText} onChange={e => setCustomText(e.target.value)} placeholder="e.g. swap the laptop for a tablet, make the woman older, add a chart on the screen…" className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm mt-2" />}
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium text-slate-300">How different from the original?</Label>
                  <span className="text-xs font-semibold text-indigo-400">{strength}/5</span>
                </div>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[strength]}
                  onValueChange={(v: number | readonly number[]) => setStrength(Array.isArray(v) ? (v as number[])[0] : (v as number))}
                  className="py-2 [&_[data-slot=slider-thumb]]:!size-5 [&_[data-slot=slider-thumb]]:!bg-indigo-400 [&_[data-slot=slider-thumb]]:!border-indigo-200 [&_[data-slot=slider-thumb]]:shadow-lg [&_[data-slot=slider-track]]:!bg-slate-700 [&_[data-slot=slider-track]]:!h-1.5 [&_[data-slot=slider-range]]:!bg-indigo-500"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{strengthOptions.find(o => o.option_key === 'strength_1')?.label ?? 'Tiny tweak'}</span>
                  <span>{strengthOptions.find(o => o.option_key === 'strength_5')?.label ?? 'Reimagine'}</span>
                </div>
              </div>
              {toggleOptions.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {toggleOptions.map(opt => (
                    <SelectCard key={opt.option_key} selected={toggleKeys.has(opt.option_key)} onClick={() => toggleToggle(opt.option_key)}>
                      <span className="text-xs text-slate-300 text-center leading-tight">{opt.label}</span>
                    </SelectCard>
                  ))}
                </div>
              )}
              {refineError && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" />{refineError}</p>}
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500" disabled={isRefining || (chipKeys.length === 0 && !customText.trim())} onClick={applyRefinements}>
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
  const parentJobId = searchParams.get('parent_job_id')

  const [tags, setTags] = useState<PromptTags>(DEFAULT_TAGS)
  const [assetType, setAssetType] = useState<AssetType>('image')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [showBrandPanel, setShowBrandPanel] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedProviderKey, setSelectedProviderKey] = useState('')
  const [planTier, setPlanTier] = useState<string>('starter')
  const [canChangeModels, setCanChangeModels] = useState(false)
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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [quotaError, setQuotaError] = useState<{ quota_type: string; quota: number; used: number; resets_at: string | null } | null>(null)
  const [generateVariants, setGenerateVariants] = useState(false)
  const [variants, setVariants] = useState<{ jobId: string; url: string }[]>([])
  const [pickedVariant, setPickedVariant] = useState<{ jobId: string; url: string } | null>(null)

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
        setPlanTier(data.plan_tier ?? 'starter')
        setCanChangeModels(!!data.can_change_models)
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

  // Pre-fill form from URL params (e.g. when arriving from Regenerate on a job page).
  // Runs once on mount; brand-context defaults are then overridden by these explicit values.
  useEffect(() => {
    const incoming: Partial<PromptTags> & { asset_type?: string } = {}
    const tagKeys: (keyof PromptTags)[] = [
      'subject', 'mood', 'platform', 'aspect_ratio', 'visual_style',
      'colour_palette', 'cta_text', 'negative_prompt', 'additional_notes',
    ]
    tagKeys.forEach(k => {
      const v = searchParams.get(k as string)
      if (v) (incoming as any)[k] = v
    })
    const at = searchParams.get('asset_type')
    if (at === 'image' || at === 'video') setAssetType(at)
    if (Object.keys(incoming).length > 0) {
      setTags(prev => ({ ...prev, ...incoming }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    if (!generatedJobId) return
    // Allow toggling: clicking same thumb again clears it; clicking the other swaps it.
    const next: 'up' | 'down' | null = feedback === thumb ? null : thumb
    setFeedback(next)
    if (next === null) return // nothing to record on the server side; row stays as last value
    const { data: { session } } = await supabase.auth.getSession(); if (!session) return
    await fetch(`${SUPABASE_URL}/functions/v1/submit-feedback`, {
      method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: generatedJobId, thumbs: next }),
    })
  }

  function handleGenerate() {
    if (!tags.subject.trim()) { setError('Subject is required'); return }
    if (!selectedModelId) { setError('No model available'); return }
    const count = (generateVariants && assetType === 'image') ? 3 : 1
    const over = assetType === 'image' ? quotaUsed + count > quotaMax : videoQuotaUsed >= videoQuotaMax
    if (over) { setError(`Not enough ${assetType} quota remaining. ${count > 1 ? `Generating ${count} variants requires ${count} credits.` : ''}`); return }
    setError(null); setGeneratedImageUrl(null); setGeneratedJobId(null); setFeedback(null); setVariants([]); setPickedVariant(null)
    startTransition(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession(); if (!session) return
        const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
        const buildRes = await fetch(`${SUPABASE_URL}/functions/v1/build-prompt`, { method: 'POST', headers, body: JSON.stringify({ signal_id: signalId, prompt_tags: { ...tags, asset_type: assetType } }) })
        if (!buildRes.ok) { const err = await buildRes.json(); setError(err.error ?? 'Failed to build prompt'); return }
        const { content_job } = await buildRes.json()
        content_job.model_id = selectedModelId; content_job.provider_key = selectedProviderKey; content_job.asset_type = assetType

        async function callGenerate() {
          const genRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-asset`, { method: 'POST', headers, body: JSON.stringify({ content_job, model_id: selectedModelId, provider_key: selectedProviderKey, ...(parentJobId ? { parent_job_id: parentJobId } : {}) }) })
          if (!genRes.ok) {
            const err = await genRes.json()
            if (genRes.status === 402 || err.error === 'quota_exceeded') { setQuotaError(err); setShowUpgradeModal(true); return null }
            else if (err.error === 'model_requires_paid_plan') { setError('This model requires a paid plan.'); return null }
            else if (err.retryable === true || genRes.status === 503 || genRes.status === 502) { setError(err.error ?? 'AI provider is temporarily unavailable. Your quota was not deducted — please try again.'); return null }
            else if (genRes.status === 401 && err.code === 'auth_failed') { setError(err.error ?? 'API key issue — check your provider key in Settings.'); return null }
            else { setError(err.error ?? 'Generation failed'); return null }
          }
          return await genRes.json()
        }

        if (count === 3) {
          // Parallel 3 — each call uses 1 credit. Run simultaneously.
          const results = await Promise.all([callGenerate(), callGenerate(), callGenerate()])
          const successful = results.filter(r => r && r.status === 'completed' && r.output_url)
          if (successful.length === 0) { setError('All 3 variants failed. Your quota was not deducted.'); return }
          setVariants(successful.map((r: any) => ({ jobId: r.job_id, url: r.output_url })))
          setQuotaUsed(prev => prev + successful.length)
          return
        }

        // Single generation
        const genData = await callGenerate()
        if (!genData) return
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
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <BackButton href={signalId ? '/dashboard' : '/library'} label={signalId ? 'Back to signals' : 'Back to library'} />
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold gtm-title tracking-tight">Create Asset</h1>
            <p className="text-slate-400 mt-1 text-sm">AI-powered GTM content, guided by your brand.</p>
          </div>
          <div className="text-right text-xs mt-1 space-x-3">
            <span className={quotaUsed >= quotaMax ? 'text-red-400' : 'text-slate-500'}>Images: {quotaUsed}/{quotaMax}</span>
            <span className={videoQuotaUsed >= videoQuotaMax ? 'text-red-400' : 'text-slate-500'}>Videos: {videoQuotaUsed}/{videoQuotaMax}</span>
          </div>
        </div>

        {/* No brand context nudge */}
        {!brand && (
          <div className="mb-4 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Your brand profile isn&apos;t set up yet — generation will use generic defaults. <a href="/settings/brand" className="underline underline-offset-2 hover:text-amber-200">Add your brand details</a> for better-grounded outputs.</span>
          </div>
        )}

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

            {/* Subject + Creative direction */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-400">What is this image/video about? <span className="text-red-400">*</span></Label>
                <Input value={tags.subject} onChange={e => handleTagChange('subject', e.target.value)} placeholder="e.g. AI is changing the way financial teams work" maxLength={200} className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500" />
                <div className="text-right text-xs text-slate-600">{tags.subject.length}/200</div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-400">
                  Creative direction <span className="text-slate-600 font-normal text-xs">— extra instructions for the AI</span>
                </Label>
                <Textarea
                  value={tags.additional_notes}
                  onChange={e => handleTagChange('additional_notes', e.target.value)}
                  placeholder={`Describe the scene like a creative director. Use quotes for exact text.\ne.g. A confident founder in a navy suit at floor-to-ceiling windows overlooking a city at dusk. Bold headline "Automate Your Outreach" in white sans-serif at the top.\ne.g. Overhead flat-lay of a sleek laptop showing a dashboard, dark walnut desk, soft studio lighting, minimal aesthetic.\ne.g. Dark navy background, glowing sky-blue dashboard interface centre-frame, amber accent on one panel.`}
                  rows={5}
                  maxLength={1500}
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none text-sm"
                />
                <div className="text-right text-xs text-slate-600">{tags.additional_notes.length}/1500</div>
              </div>
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
                  <ImageIcon className="w-6 h-6 text-slate-300" /><span className="text-sm font-medium text-slate-200">Image</span>
                </SelectCard>
                <SelectCard selected={assetType === 'video'} onClick={() => setAssetType('video')}>
                  <Video className="w-6 h-6 text-slate-300" /><span className="text-sm font-medium text-slate-200">Video</span>
                </SelectCard>
              </div>
            </div>

            {/* Model selector — hidden when org can't change models (starter / byok).
                Shows a passive "Using X" line so the user knows what's running. */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <Label className="text-sm font-medium text-slate-400">AI Model</Label>
              {filteredModels.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-300">
                    {assetType === 'video'
                      ? 'Video generation isn\u2019t available on your current plan.'
                      : 'No image models available on your current plan.'}
                  </p>
                  <a href="/settings/billing" className="inline-flex text-xs text-indigo-300 hover:text-indigo-200 underline underline-offset-2">Upgrade plan →</a>
                </div>
              ) : canChangeModels ? (
                <>
                  <select value={selectedModelId} onChange={e => { const m = filteredModels.find(x => x.model_id === e.target.value); if (m) { setSelectedModelId(m.model_id); setSelectedProviderKey(m.provider_key) } }} className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {filteredModels.map(m => <option key={m.model_id} value={m.model_id}>{m.model_label}{m.default_for_step_key?.some(s => s.includes(assetType)) ? ' ★' : ''}</option>)}
                  </select>
                  {selectedModel && <p className="text-xs text-slate-500">{selectedModel.estimated_time_seconds ? `~${selectedModel.estimated_time_seconds}s · ` : ''}{selectedModel.cost_tier ?? ''}{selectedModel.org_has_key ? ' · Your key' : ' · Platform key'}</p>}
                  <a href="/settings/models" className="text-xs text-slate-500 hover:text-indigo-400 underline underline-offset-2">Change default in Settings</a>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-md">
                    <span className="text-sm text-slate-200 truncate">{selectedModel?.model_label ?? filteredModels[0]?.model_label}</span>
                    <span className="text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5 whitespace-nowrap">Default</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedModel?.estimated_time_seconds ? `~${selectedModel.estimated_time_seconds}s` : ''}
                    {' · '}Optimised for your plan.
                  </p>
                  <a href="/settings/billing" className="text-xs text-slate-500 hover:text-indigo-400 underline underline-offset-2">Upgrade to choose models</a>
                </>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}

            {/* Generate button */}
            <div className="sticky bottom-4 lg:static space-y-2">
              {/* Variant toggle — images only (video is async, can't show 3-up easily) */}
              {assetType === 'image' && (
                <button
                  type="button"
                  onClick={() => setGenerateVariants(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                    generateVariants
                      ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${generateVariants ? 'bg-indigo-600 border-indigo-500' : 'border-slate-600'}`}>
                      {generateVariants && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    Generate 3 variants to choose from
                  </span>
                  <span className="text-xs text-slate-500">uses 3 credits</span>
                </button>
              )}
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 text-base" disabled={isPending || !tags.subject.trim() || filteredModels.length === 0} onClick={handleGenerate}>
                {isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{assetType === 'video' ? 'Submitting…' : generateVariants ? 'Generating 3 variants…' : 'Generating…'}</>
                  : generateVariants && assetType === 'image' ? 'Generate 3 Variants' : `Generate ${assetType === 'image' ? 'Image' : 'Video'}`}
              </Button>
              <p className="text-center text-xs text-slate-600">{quotaRemaining} {assetType}{quotaRemaining !== 1 ? 's' : ''} remaining this month</p>
            </div>

            {/* Generation in progress */}
            {isPending && (
              <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
                <div className="absolute inset-0 gtm-mesh opacity-50" />
                <div className="relative flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-400/40 animate-ping" />
                    <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-glow-violet">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  </div>
                  <p className="text-sm font-medium gtm-shimmer-text">{assetType === 'video' ? 'Submitting video job…' : 'Generating your image…'}</p>
                  {assetType === 'image' && <p className="text-xs text-slate-300/80 italic">"{tags.subject.slice(0, 60)}{tags.subject.length > 60 ? '…' : ''}"</p>}
                </div>
              </div>
            )}

            {/* 3-variant picker */}
            {variants.length > 0 && !isPending && !pickedVariant && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">Pick your favourite</p>
                  <p className="text-xs text-slate-500 mt-0.5">Click the image you want to keep. The others are discarded.</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {variants.map((v, i) => (
                    <button
                      key={v.jobId}
                      type="button"
                      onClick={() => {
                        setPickedVariant(v)
                        setGeneratedImageUrl(v.url)
                        setGeneratedJobId(v.jobId)
                        setVariants([])
                      }}
                      className="group relative rounded-lg overflow-hidden border-2 border-slate-700 hover:border-indigo-500 transition-colors focus:outline-none focus:border-indigo-400"
                    >
                      <img src={v.url} alt={`Variant ${i + 1}`} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-200" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100">
                        <span className="text-xs font-medium text-white bg-indigo-600 rounded-md px-2 py-0.5">Pick this</span>
                      </div>
                      <div className="absolute top-1.5 left-1.5 bg-slate-950/80 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold text-slate-300">{i + 1}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Inline image result */}
            {generatedImageUrl && generatedJobId && !isPending && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <img src={generatedImageUrl} alt="Generated asset" className="w-full rounded-lg border border-slate-700 object-cover" />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="!bg-slate-800 !text-slate-100 border-slate-700 hover:!bg-slate-700" onClick={async () => { try { const res = await fetch(generatedImageUrl); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `gtm-${generatedJobId.slice(0, 8)}.png`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url) } catch {} }}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />Download
                  </Button>
                  <Button variant="outline" size="sm" className="!bg-slate-800 !text-slate-100 border-slate-700 hover:!bg-slate-700" onClick={() => setShowRefinement(true)}>
                    <Wand2 className="w-3.5 h-3.5 mr-1.5" />Refine
                  </Button>
                  <Button variant="outline" size="sm" className="!bg-slate-800 !text-slate-100 border-slate-700 hover:!bg-slate-700" onClick={() => router.push(`/icp?job_id=${generatedJobId}`)}>
                    <Target className="w-3.5 h-3.5 mr-1.5" />For campaign
                  </Button>
                  <Button variant="outline" size="sm" className="!bg-slate-800 !text-slate-100 border-slate-700 hover:!bg-slate-700" onClick={() => { setGeneratedImageUrl(null); setGeneratedJobId(null); setFeedback(null); handleGenerate() }}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Regenerate
                  </Button>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <span className="text-xs text-slate-500">Was this image good?</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => submitFeedback('up')} className={`p-1.5 rounded transition-colors ${feedback === 'up' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}><ThumbsUp className="w-4 h-4" /></button>
                    <button type="button" onClick={() => submitFeedback('down')} className={`p-1.5 rounded transition-colors ${feedback === 'down' ? 'text-red-400' : 'text-slate-500 hover:text-slate-300'}`}><ThumbsDown className="w-4 h-4" /></button>
                    <button type="button" onClick={() => router.push(`/create/${generatedJobId}`)} className="text-xs text-slate-500 hover:text-indigo-400 ml-2">Full view →</button>
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-3">
                  <SocialCopySection
                    jobId={generatedJobId}
                    captions={null}
                    preferredPlatform={tags.platform ?? null}
                    compact
                  />
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

      {/* Quota exceeded upgrade modal */}
      <Dialog open={showUpgradeModal} onOpenChange={open => !open && setShowUpgradeModal(false)}>
        <DialogContent className="bg-[#12121e] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Generation limit reached</DialogTitle>
            <DialogDescription className="text-slate-400">
              {quotaError ? (
                <>You have used {quotaError.used ?? 0} of {quotaError.quota === 999999 ? 'unlimited' : quotaError.quota} {quotaError.quota_type}s this month.{quotaError.resets_at ? ` Resets on ${new Date(quotaError.resets_at).toLocaleDateString()}.` : ''}</>
              ) : (
                <>You have reached your generation quota for this month.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" className="text-slate-400" onClick={() => setShowUpgradeModal(false)}>
              Wait for reset
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
              onClick={() => { setShowUpgradeModal(false); router.push('/settings/billing') }}
            >
              Upgrade plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
