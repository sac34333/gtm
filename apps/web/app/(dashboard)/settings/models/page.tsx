'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { Lock, ChevronDown, RotateCcw, Eye, EyeOff, ExternalLink, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useOrgStore } from '@/store/org.store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvailableModel {
  id: string
  model_id: string
  provider_key: string
  model_label: string
  model_type: string
  cost_tier: string
  key_source: string
  compatible_step_keys: string[]
  default_for_step_key: string[]
  is_recommended: boolean
  recommendation_order: number | null
  recommendation_text: string | null
  release_date: string | null
  estimated_time_seconds: number | null
  is_active: boolean
}

interface Provider {
  provider_key: string
  display_name: string
  platform_key_available: boolean
  has_org_key: boolean
  docs_url: string | null
  models: AvailableModel[]
}

interface Preference {
  step_key: string
  provider_key: string
  model_id: string
  model_label: string
}

interface ModelsData {
  providers: Provider[]
  recommended: AvailableModel[]
  preferences: Preference[]
  cached_at: string
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEP_CARDS = [
  {
    step_key: 'image_generation',
    label: 'Image Generation',
    model_type: 'image',
    note: null,
  },
  {
    step_key: 'video_generation',
    label: 'Video Generation',
    model_type: 'video',
    note: null,
  },
  {
    step_key: 'prompt_assembly',
    label: 'Prompt Assembly',
    model_type: 'text',
    note: null,
  },
  {
    step_key: 'relevance_scoring',
    label: 'Relevance Scoring',
    model_type: 'text',
    note: 'In v1, ingest-signals uses TF-IDF (zero AI cost). This card reserves configuration for future on-demand AI rescoring.',
  },
  {
    step_key: 'outreach_copy',
    label: 'Outreach Copy',
    model_type: 'text',
    note: null,
  },
  {
    step_key: 'campaign_brief',
    label: 'Campaign Brief',
    model_type: 'text',
    note: null,
  },
  {
    step_key: 'brand_embedding',
    label: 'Brand Embedding',
    model_type: 'embedding',
    note: null,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callEdgeFunction(name: string, method: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession()
  const resp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'request_failed' }))
    throw new Error(err.error ?? 'request_failed')
  }
  return resp.json()
}

function getCostBadgeColor(tier: string) {
  const map: Record<string, string> = {
    free: 'bg-emerald-500/15 text-emerald-400',
    low: 'bg-emerald-500/15 text-emerald-400',
    medium: 'bg-amber-500/15 text-amber-400',
    high: 'bg-red-500/15 text-red-400',
    ultra: 'bg-purple-500/15 text-purple-400',
  }
  return map[tier] ?? 'bg-slate-700 text-slate-300'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RecommendationCard({ model }: { model: AvailableModel }) {
  return (
    <div className="flex-shrink-0 w-64 rounded-xl border border-white/8 bg-white/4 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white leading-snug">{model.model_label}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCostBadgeColor(model.cost_tier)}`}>
          {model.cost_tier}
        </span>
      </div>
      <p className="text-xs text-slate-400">{model.provider_key}</p>
      {model.recommendation_text && (
        <p className="text-xs text-slate-300 leading-relaxed">{model.recommendation_text}</p>
      )}
      {model.release_date && (
        <p className="text-xs text-slate-500">Released {model.release_date}</p>
      )}
    </div>
  )
}

function ProviderStatusBadge({
  provider,
  onClick,
}: {
  provider: Provider
  onClick: () => void
}) {
  const status = provider.has_org_key ? 'org'
    : provider.platform_key_available ? 'platform'
    : 'none'

  const colors = {
    org: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    platform: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    none: 'bg-red-500/15 text-red-400 border-red-500/30',
  }
  const labels = {
    org: 'Your key',
    platform: 'Platform key',
    none: 'No key',
  }

  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded border font-medium cursor-pointer transition-opacity hover:opacity-80 ${colors[status]}`}
    >
      {provider.display_name}: {labels[status]}
    </button>
  )
}

function StepCard({
  step,
  allModels,
  providers,
  currentPref,
  onChange,
  onSave,
  isAdmin,
  isSaving,
}: {
  step: typeof STEP_CARDS[0]
  allModels: AvailableModel[]
  providers: Provider[]
  currentPref: Preference | undefined
  onChange: (pref: Preference) => void
  onSave: (stepKey: string) => void
  isAdmin: boolean
  isSaving: boolean
}) {
  const compatible = allModels.filter(m =>
    m.compatible_step_keys?.includes(step.step_key),
  )

  const defaultModel = allModels.find(m =>
    Array.isArray(m.default_for_step_key) && m.default_for_step_key.includes(step.step_key),
  )

  const selectedModelId = currentPref?.model_id ?? defaultModel?.model_id ?? ''
  const selectedModel = allModels.find(m => m.model_id === selectedModelId)

  const providerMap = new Map(providers.map(p => [p.provider_key, p]))

  const isLocked = selectedModel
    ? !providerMap.get(selectedModel.provider_key)?.has_org_key &&
      !providerMap.get(selectedModel.provider_key)?.platform_key_available
    : false

  function handleSelect(modelId: string) {
    const m = allModels.find(x => x.model_id === modelId)
    if (!m) return
    onChange({
      step_key: step.step_key,
      provider_key: m.provider_key,
      model_id: m.model_id,
      model_label: m.model_label,
    })
  }

  function handleReset() {
    if (!defaultModel) return
    onChange({
      step_key: step.step_key,
      provider_key: defaultModel.provider_key,
      model_id: defaultModel.model_id,
      model_label: defaultModel.model_label,
    })
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{step.label}</h3>
        {defaultModel?.model_id === selectedModelId && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">Default</span>
        )}
      </div>

      {step.note && (
        <p className="text-xs text-amber-400/80 bg-amber-500/10 rounded-lg px-3 py-2">{step.note}</p>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={selectedModelId}
            onValueChange={handleSelect}
            disabled={!isAdmin}
          >
            <SelectTrigger className="bg-white/5 border-white/10 text-white h-9">
              <SelectValue placeholder="Select model…">
                {selectedModel && (
                  <span className="flex items-center gap-2">
                    {isLocked && <Lock className="w-3 h-3 text-red-400" />}
                    {selectedModel.model_label}
                    <span className="text-slate-400">({selectedModel.provider_key})</span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/10 max-h-64">
              {compatible.map(m => {
                const prov = providerMap.get(m.provider_key)
                const locked = !prov?.has_org_key && !prov?.platform_key_available
                return (
                  <SelectItem key={m.model_id} value={m.model_id} className="text-white">
                    <span className="flex items-center gap-2">
                      {locked && <Lock className="w-3 h-3 text-red-400" />}
                      {m.model_label}
                      <span className="text-slate-400 text-xs">({m.provider_key})</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getCostBadgeColor(m.cost_tier)}`}>
                        {m.cost_tier}
                      </span>
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 text-white hover:bg-white/8 h-9 px-3"
            onClick={() => onSave(step.step_key)}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        )}
      </div>

      {isAdmin && defaultModel && defaultModel.model_id !== selectedModelId && (
        <button
          className="text-xs text-slate-400 hover:text-white transition-colors"
          onClick={handleReset}
        >
          <RotateCcw className="w-3 h-3 inline mr-1" />
          Reset to default
        </button>
      )}
    </div>
  )
}

function ProviderKeyCard({
  provider,
  isAdmin,
  planTier,
  cardRef,
}: {
  provider: Provider
  isAdmin: boolean
  planTier: string
  cardRef?: React.RefObject<HTMLDivElement>
}) {
  const queryClient = useQueryClient()
  const [keyValue, setKeyValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isFullySubscribed = planTier === 'fully_subscribed'
  const disabled = !isAdmin || isFullySubscribed

  const saveMutation = useMutation({
    mutationFn: () => callEdgeFunction('save-provider-keys', 'POST', {
      provider_key: provider.provider_key,
      api_key: keyValue,
    }),
    onSuccess: () => {
      toast.success(`${provider.display_name} key saved`)
      setKeyValue('')
      queryClient.invalidateQueries({ queryKey: ['available-models'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => callEdgeFunction('delete-provider-key', 'DELETE', {
      provider_key: provider.provider_key,
    }),
    onSuccess: () => {
      toast.success(`${provider.display_name} key deleted`)
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: ['available-models'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const status = provider.has_org_key ? 'org'
    : provider.platform_key_available ? 'platform'
    : 'none'

  return (
    <div ref={cardRef} className="rounded-xl border border-white/8 bg-white/4 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{provider.display_name}</h3>
          {provider.docs_url && (
            <a
              href={provider.docs_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1 mt-0.5"
            >
              API docs <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border ${
          status === 'org' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          : status === 'platform' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          : 'bg-red-500/15 text-red-400 border-red-500/30'
        }`}>
          {status === 'org' ? 'Your key active' : status === 'platform' ? 'Platform key active' : 'No key'}
        </span>
      </div>

      {isFullySubscribed && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
          <Lock className="w-3 h-3" />
          API key management is disabled on the Fully Subscribed plan.
        </div>
      )}

      {!isAdmin && (
        <p className="text-xs text-slate-400">Contact your admin to change this setting.</p>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? 'text' : 'password'}
            placeholder="Paste your API key"
            value={keyValue}
            onChange={e => setKeyValue(e.target.value)}
            disabled={disabled}
            className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 pr-9 h-9"
          />
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            tabIndex={-1}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Button
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-500 text-white h-9"
          onClick={() => saveMutation.mutate()}
          disabled={disabled || !keyValue.trim() || saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        {provider.has_org_key && (
          <Button
            size="sm"
            variant="destructive"
            className="h-9"
            onClick={() => setDeleteOpen(true)}
            disabled={disabled || deleteMutation.isPending}
          >
            Delete
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Your key is AES-256-GCM encrypted before storage and cannot be viewed after saving — only replaced or deleted.
      </p>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-[#12121e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Delete {provider.display_name} key?</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will remove your API key. The platform key will be used if available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsModelsPage() {
  const { userRole, org } = useOrgStore()
  const isAdmin = userRole === 'admin' || userRole === 'owner'
  const queryClient = useQueryClient()

  const [pendingPrefs, setPendingPrefs] = useState<Record<string, Preference>>({})
  const [savingStep, setSavingStep] = useState<string | null>(null)
  const [isSavingAll, setIsSavingAll] = useState(false)

  const providerRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({})

  const { data, isLoading, isError, refetch } = useQuery<ModelsData>({
    queryKey: ['available-models'],
    queryFn: () => callEdgeFunction('get-available-models', 'GET'),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  const allModels = data?.providers.flatMap(p => p.models) ?? []

  function getCurrentPref(stepKey: string): Preference | undefined {
    return pendingPrefs[stepKey] ?? data?.preferences.find(p => p.step_key === stepKey)
  }

  async function saveStep(stepKey: string) {
    const pref = pendingPrefs[stepKey]
    if (!pref) return
    setSavingStep(stepKey)
    try {
      const result = await callEdgeFunction('save-model-preferences', 'POST', {
        preferences: [pref],
      })
      if (result.saved?.includes(stepKey)) {
        toast.success('Preference saved')
        queryClient.invalidateQueries({ queryKey: ['available-models'] })
      } else {
        const err = result.errors?.find((e: any) => e.step_key === stepKey)
        toast.error(err?.reason ?? 'Save failed')
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingStep(null)
    }
  }

  async function saveAllChanges() {
    const prefs = Object.values(pendingPrefs)
    if (prefs.length === 0) { toast.info('No changes to save'); return }
    setIsSavingAll(true)
    try {
      const result = await callEdgeFunction('save-model-preferences', 'POST', { preferences: prefs })
      toast.success(`Saved ${result.saved?.length ?? 0} preference(s)`)
      if (result.errors?.length > 0) {
        toast.warning(`${result.errors.length} error(s): ${result.errors.map((e: any) => e.reason).join(', ')}`)
      }
      queryClient.invalidateQueries({ queryKey: ['available-models'] })
      setPendingPrefs({})
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSavingAll(false)
    }
  }

  function scrollToProvider(providerKey: string) {
    providerRefs.current[providerKey]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (isLoading) return <SettingsModelsLoading />
  if (isError) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12 space-y-4">
        <h1 className="text-2xl font-bold text-white">Model Settings</h1>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-red-300">Failed to load model settings.</p>
          <Button variant="outline" className="border-white/10 text-white" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Model Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Choose AI models for each generation step.</p>
      </div>

      {/* Recommendations carousel */}
      {data?.recommended && data.recommended.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Recommended models</h2>
          <ScrollArea className="w-full whitespace-nowrap rounded-xl">
            <div className="flex gap-3 pb-3">
              {[...data.recommended]
                .sort((a, b) => (a.recommendation_order ?? 99) - (b.recommendation_order ?? 99))
                .map(m => (
                  <RecommendationCard key={m.model_id} model={m} />
                ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Provider status badges */}
      {data?.providers && data.providers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Provider key status</h2>
          <div className="flex flex-wrap gap-2">
            {data.providers.map(p => (
              <ProviderStatusBadge
                key={p.provider_key}
                provider={p}
                onClick={() => scrollToProvider(p.provider_key)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Generation steps</h2>
        <div className="space-y-3">
          {STEP_CARDS.map(step => (
            <StepCard
              key={step.step_key}
              step={step}
              allModels={allModels}
              providers={data?.providers ?? []}
              currentPref={getCurrentPref(step.step_key)}
              onChange={pref => setPendingPrefs(p => ({ ...p, [pref.step_key]: pref }))}
              onSave={saveStep}
              isAdmin={isAdmin}
              isSaving={savingStep === step.step_key}
            />
          ))}
        </div>

        {isAdmin && Object.keys(pendingPrefs).length > 0 && (
          <div className="mt-4 flex justify-end">
            <Button
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
              onClick={saveAllChanges}
              disabled={isSavingAll}
            >
              {isSavingAll ? 'Saving…' : `Save all changes (${Object.keys(pendingPrefs).length})`}
            </Button>
          </div>
        )}
      </div>

      {/* Provider API keys */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Provider API keys</h2>
        <div className="space-y-3">
          {(data?.providers ?? []).map(provider => {
            if (!providerRefs.current[provider.provider_key]) {
              providerRefs.current[provider.provider_key] = { current: null } as any
            }
            return (
              <ProviderKeyCard
                key={provider.provider_key}
                provider={provider}
                isAdmin={isAdmin}
                planTier={org?.plan_tier ?? 'starter'}
                cardRef={providerRefs.current[provider.provider_key]}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SettingsModelsLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-48 bg-white/5" />
      <div className="flex gap-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-64 bg-white/5 rounded-xl" />)}
      </div>
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <Skeleton key={i} className="h-20 w-full bg-white/5 rounded-xl" />
      ))}
    </div>
  )
}
