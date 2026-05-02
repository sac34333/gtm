'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Code2, ChevronRight, Zap, Lock, Clock } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

type PromptTags = {
  subject: string
  visual_style: string
  mood: string
  colour_palette: string
  platform: string
  aspect_ratio: string
  cta_text: string
  negative_prompt: string
  additional_notes: string
}

const DEFAULT_TAGS: PromptTags = {
  subject: '',
  visual_style: 'Photography',
  mood: 'Professional',
  colour_palette: '',
  platform: 'LinkedIn',
  aspect_ratio: '1:1',
  cta_text: '',
  negative_prompt: '',
  additional_notes: '',
}

type Model = {
  model_id: string
  provider_key: string
  model_label: string
  model_type: string
  cost_tier: string | null
  estimated_time_seconds: number | null
  requires_paid_plan: boolean
  key_source: string
  org_has_key: boolean
  default_for_step_key: string[] | null
}

type BrandContext = {
  company_name: string | null
  brand_colours: any
  tone_formal_conversational: number | null
  tone_safe_bold: number | null
  tone_corporate_human: number | null
  tone_data_story: number | null
  tone_conservative_provocative: number | null
  active_themes: string[] | null
  decision_maker_titles: string[] | null
  topics_to_avoid: string[] | null
  phrases_to_avoid: string[] | null
  visual_styles_to_avoid: string[] | null
}

type QuotaInfo = {
  image_used: number
  image_quota: number
}

export default function CreatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const signalId = searchParams.get('signal_id')

  const [tags, setTags] = useState<PromptTags>(DEFAULT_TAGS)
  const [showJson, setShowJson] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [models, setModels] = useState<Model[]>([])
  const [preferences, setPreferences] = useState<any[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [selectedProviderKey, setSelectedProviderKey] = useState<string>('')
  const [brand, setBrand] = useState<BrandContext | null>(null)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      }

      // Load models, brand context, and quota in parallel
      const [modelsRes, brandRes, quotaRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/functions/v1/get-available-models`, { headers }),
        supabase.from('brand_contexts').select('*').single(),
        fetch(`${SUPABASE_URL}/functions/v1/check-quota`, { headers }),
      ])

      if (modelsRes.ok) {
        const data = await modelsRes.json()
        const imageModels: Model[] = (data.models ?? []).filter((m: Model) => m.model_type === 'image')
        setModels(imageModels)
        setPreferences(data.preferences ?? [])

        // Pre-select from preferences or default
        const pref = (data.preferences ?? []).find((p: any) => p.step_key === 'image_generation')
        const defaultModel = pref
          ? imageModels.find((m) => m.model_id === pref.model_id)
          : imageModels.find((m) => m.default_for_step_key?.includes('image_generation'))
        if (defaultModel) {
          setSelectedModelId(defaultModel.model_id)
          setSelectedProviderKey(defaultModel.provider_key)
        } else if (imageModels.length > 0) {
          setSelectedModelId(imageModels[0].model_id)
          setSelectedProviderKey(imageModels[0].provider_key)
        }
      }

      if (!brandRes.error && brandRes.data) {
        const b = brandRes.data as BrandContext
        setBrand(b)
        // Pre-fill colour palette and negative prompt from brand
        const colours = b.brand_colours as any
        if (colours) {
          const palette = [
            colours.primary ? `Primary: ${colours.primary}` : '',
            colours.secondary ? `Secondary: ${colours.secondary}` : '',
            colours.accent ? `Accent: ${colours.accent}` : '',
          ].filter(Boolean).join(', ')
          if (palette) setTags(prev => ({ ...prev, colour_palette: palette }))
        }
        const neg = [
          ...(b.topics_to_avoid ?? []),
          ...(b.phrases_to_avoid ?? []),
          ...(b.visual_styles_to_avoid ?? []),
        ].join(', ')
        if (neg) setTags(prev => ({ ...prev, negative_prompt: neg }))
      }

      if (quotaRes.ok) {
        const q = await quotaRes.json()
        setQuota({ image_used: q.image_used, image_quota: q.image_quota })
      }
    }
    load()
  }, [])

  // Sync JSON display when tags change
  useEffect(() => {
    if (showJson) {
      setJsonText(JSON.stringify({ signal_id: signalId, prompt_tags: tags }, null, 2))
    }
  }, [tags, showJson, signalId])

  function handleTagChange(key: keyof PromptTags, value: string) {
    setTags(prev => ({ ...prev, [key]: value }))
  }

  function handleJsonChange(text: string) {
    setJsonText(text)
    try {
      const parsed = JSON.parse(text)
      if (parsed.prompt_tags) {
        setTags(prev => ({ ...prev, ...parsed.prompt_tags }))
      }
    } catch { /* invalid JSON — ignore */ }
  }

  function handleGenerate() {
    if (!tags.subject.trim()) {
      setError('Subject is required')
      return
    }
    if (!selectedModelId || !selectedProviderKey) {
      setError('Select a model')
      return
    }

    setError(null)

    startTransition(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const headers = {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }

        // Check quota
        if (quota && quota.image_used >= quota.image_quota) {
          setError(`Image quota reached (${quota.image_used}/${quota.image_quota}). Upgrade to continue.`)
          return
        }

        // Build prompt
        const buildRes = await fetch(`${SUPABASE_URL}/functions/v1/build-prompt`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ signal_id: signalId, prompt_tags: tags }),
        })
        if (!buildRes.ok) {
          const err = await buildRes.json()
          setError(err.error ?? 'Failed to build prompt')
          return
        }
        const { content_job } = await buildRes.json()

        // Override model if user selected one
        content_job.model_id = selectedModelId
        content_job.provider_key = selectedProviderKey

        // Subscribe to Realtime BEFORE calling generate-asset
        let jobId: string | null = null
        const channelRef = { current: null as any }

        // Generate asset
        const genRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-asset`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content_job,
            model_id: selectedModelId,
            provider_key: selectedProviderKey,
          }),
        })

        if (!genRes.ok) {
          const err = await genRes.json()
          if (err.error === 'quota_exceeded') {
            setError(`Image quota reached. Upgrade to continue.`)
          } else if (err.error === 'model_requires_paid_plan') {
            setError('This model requires a paid plan.')
          } else {
            setError(err.error ?? 'Generation failed')
          }
          return
        }

        const genData = await genRes.json()
        jobId = genData.job_id

        if (genData.status === 'completed') {
          // Fast image — navigate directly
          router.push(`/create/${jobId}`)
          return
        }

        // Async (video) — subscribe to Realtime and redirect to dashboard
        if (jobId) {
          const channel = supabase.channel(`job:${jobId}`)
          channel.on('broadcast', { event: 'job_complete' }, ({ payload }: any) => {
            router.push(`/create/${payload.job_id}`)
          }).subscribe()
        }

        router.push('/dashboard')
      } catch (err: any) {
        setError(err.message ?? 'Unexpected error')
      }
    })
  }

  const imageModels = models.filter(m => m.model_type === 'image')
  const videoModels = models.filter(m => m.model_type === 'video')

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Create Asset</h1>
          <p className="text-slate-400 mt-1 text-sm">
            {signalId ? 'Generating from a trend signal.' : 'Generate AI-powered GTM content.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel — Prompt tag editor (2/3 width) */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">

              {/* Subject */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm font-medium">
                  Subject <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={tags.subject}
                  onChange={e => handleTagChange('subject', e.target.value)}
                  placeholder="e.g. B2B SaaS founder reading market insights"
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              {/* Visual Style + Mood row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm font-medium">Visual Style</Label>
                  <select
                    value={tags.visual_style}
                    onChange={e => handleTagChange('visual_style', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {['Photography', 'Illustration', 'Abstract', '3D', 'Flat'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm font-medium">Mood</Label>
                  <select
                    value={tags.mood}
                    onChange={e => handleTagChange('mood', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {['Professional', 'Bold', 'Calm', 'Energetic', 'Minimal', 'Playful', 'Sophisticated'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Colour Palette */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm font-medium">Colour Palette</Label>
                <Input
                  value={tags.colour_palette}
                  onChange={e => handleTagChange('colour_palette', e.target.value)}
                  placeholder="Primary: #1a1a2e, Secondary: #16213e, Accent: #0f3460"
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              {/* Platform + Aspect Ratio row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm font-medium">Platform</Label>
                  <select
                    value={tags.platform}
                    onChange={e => handleTagChange('platform', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {['LinkedIn', 'Instagram', 'Twitter', 'Generic'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm font-medium">Aspect Ratio</Label>
                  <select
                    value={tags.aspect_ratio}
                    onChange={e => handleTagChange('aspect_ratio', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {['1:1', '16:9', '9:16', '4:5'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CTA Text */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm font-medium">CTA Text <span className="text-slate-500 font-normal">(optional)</span></Label>
                <Input
                  value={tags.cta_text}
                  onChange={e => handleTagChange('cta_text', e.target.value)}
                  placeholder="e.g. Book a demo"
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              {/* Negative Prompt */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm font-medium">Negative Prompt</Label>
                <Textarea
                  value={tags.negative_prompt}
                  onChange={e => handleTagChange('negative_prompt', e.target.value)}
                  placeholder="Things to avoid..."
                  rows={2}
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none"
                />
              </div>

              {/* Additional Notes */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm font-medium">Additional Notes <span className="text-slate-500 font-normal">(optional)</span></Label>
                <Textarea
                  value={tags.additional_notes}
                  onChange={e => handleTagChange('additional_notes', e.target.value)}
                  placeholder="Any extra context..."
                  rows={2}
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none"
                />
              </div>

              {/* View JSON toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !showJson
                    setShowJson(next)
                    if (next) setJsonText(JSON.stringify({ signal_id: signalId, prompt_tags: tags }, null, 2))
                  }}
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
                >
                  <Code2 className="h-4 w-4" />
                  {showJson ? 'Hide JSON' : 'View JSON'}
                </button>
                {showJson && (
                  <Textarea
                    value={jsonText}
                    onChange={e => handleJsonChange(e.target.value)}
                    rows={10}
                    className="mt-3 bg-slate-950 border-slate-700 text-green-400 font-mono text-xs resize-none"
                    spellCheck={false}
                  />
                )}
              </div>
            </div>

            {/* Model selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-slate-200 font-semibold text-sm">Select Model</h2>

              {models.length === 0 && (
                <p className="text-slate-500 text-sm">Loading models...</p>
              )}

              {imageModels.length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">Image</p>
                  <div className="space-y-2">
                    {imageModels.map(m => (
                      <ModelOption
                        key={`${m.provider_key}/${m.model_id}`}
                        model={m}
                        selected={selectedModelId === m.model_id && selectedProviderKey === m.provider_key}
                        onSelect={() => { setSelectedModelId(m.model_id); setSelectedProviderKey(m.provider_key) }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {videoModels.length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">Video</p>
                  <div className="space-y-2">
                    {videoModels.map(m => (
                      <ModelOption
                        key={`${m.provider_key}/${m.model_id}`}
                        model={m}
                        selected={selectedModelId === m.model_id && selectedProviderKey === m.provider_key}
                        onSelect={() => { setSelectedModelId(m.model_id); setSelectedProviderKey(m.provider_key) }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Quota display + Generate button */}
            <div className="flex items-center justify-between">
              {quota && (
                <p className="text-slate-500 text-sm">
                  {quota.image_used} / {quota.image_quota} images used
                </p>
              )}
              <Button
                onClick={handleGenerate}
                disabled={isPending || !tags.subject.trim() || !selectedModelId}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 ml-auto"
              >
                {isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" />Generate</>
                )}
              </Button>
            </div>
          </div>

          {/* Right panel — Brand context sidebar (1/3 width) */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
              <h2 className="text-slate-200 font-semibold text-sm">Brand Context</h2>

              {!brand && <p className="text-slate-500 text-sm">Loading brand...</p>}

              {brand && (
                <>
                  {/* Colour swatches */}
                  {brand.brand_colours && (
                    <div>
                      <p className="text-slate-500 text-xs mb-2">Colours</p>
                      <div className="flex gap-2">
                        {Object.entries(brand.brand_colours as Record<string, string>).map(([name, hex]) => (
                          <div key={name} className="flex flex-col items-center gap-1">
                            <div
                              className="w-8 h-8 rounded-md border border-slate-700"
                              style={{ backgroundColor: hex }}
                              title={`${name}: ${hex}`}
                            />
                            <span className="text-slate-600 text-xs capitalize">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tone summary */}
                  <div>
                    <p className="text-slate-500 text-xs mb-2">Tone</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Formal ↔ Conversational', value: brand.tone_formal_conversational },
                        { label: 'Safe ↔ Bold', value: brand.tone_safe_bold },
                        { label: 'Corporate ↔ Human', value: brand.tone_corporate_human },
                        { label: 'Data ↔ Story', value: brand.tone_data_story },
                        { label: 'Conservative ↔ Provocative', value: brand.tone_conservative_provocative },
                      ].filter(t => t.value !== null).map(t => (
                        <span key={t.label} className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-full">
                          {t.label}: <strong>{t.value}</strong>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Active themes */}
                  {brand.active_themes && brand.active_themes.length > 0 && (
                    <div>
                      <p className="text-slate-500 text-xs mb-2">Active Themes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {brand.active_themes.map(t => (
                          <span key={t} className="bg-indigo-900/50 text-indigo-300 text-xs px-2 py-1 rounded-full border border-indigo-700/50">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Decision maker titles */}
                  {brand.decision_maker_titles && brand.decision_maker_titles.length > 0 && (
                    <div>
                      <p className="text-slate-500 text-xs mb-2">Target Audience</p>
                      <div className="flex flex-wrap gap-1.5">
                        {brand.decision_maker_titles.map(t => (
                          <span key={t} className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModelOption({ model, selected, onSelect }: {
  model: Model
  selected: boolean
  onSelect: () => void
}) {
  const isLocked = model.key_source === 'user_required' && !model.org_has_key
  const timeLabel = model.estimated_time_seconds
    ? model.estimated_time_seconds < 60
      ? `~${model.estimated_time_seconds}s`
      : `~${Math.round(model.estimated_time_seconds / 60)}min`
    : null

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
        selected
          ? 'border-indigo-500 bg-indigo-900/30'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {isLocked && <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
        <div>
          <p className="text-slate-200 text-sm font-medium">{model.model_label}</p>
          <p className="text-slate-500 text-xs capitalize">{model.provider_key.replace(/_/g, ' ')}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {model.cost_tier && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            model.cost_tier === 'free' ? 'bg-green-900/40 text-green-400' :
            model.cost_tier === 'low' ? 'bg-blue-900/40 text-blue-400' :
            'bg-amber-900/40 text-amber-400'
          }`}>
            {model.cost_tier}
          </span>
        )}
        {timeLabel && (
          <span className="flex items-center gap-1 text-slate-500 text-xs">
            <Clock className="h-3 w-3" />{timeLabel}
          </span>
        )}
      </div>
    </button>
  )
}
