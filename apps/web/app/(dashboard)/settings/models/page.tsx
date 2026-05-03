'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { Lock, RotateCcw, Eye, EyeOff, ExternalLink, AlertCircle, KeyRound, Sparkles, Zap, Image as ImageIcon, Video, FileText, Brain, Mail, FileSignature, Search, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const STEP_CARDS: Array<{ step_key: string; label: string; description: string; model_type: string; icon: React.ComponentType<{ className?: string }>; note: string | null }> = [
  { step_key: 'image_generation', label: 'Image Generation', description: 'Used when you click Generate Image on /create.', model_type: 'image', icon: ImageIcon, note: null },
  { step_key: 'video_generation', label: 'Video Generation', description: 'Used when you click Generate Video on /create.', model_type: 'video', icon: Video, note: null },
  { step_key: 'prompt_assembly', label: 'Prompt Assembly', description: 'Builds the final image / video prompt from your tags + brand context + signal.', model_type: 'text', icon: FileText, note: null },
  { step_key: 'outreach_copy', label: 'Outreach Copy', description: 'Personalises ICP outreach messages.', model_type: 'text', icon: Mail, note: null },
  { step_key: 'campaign_brief', label: 'Campaign Brief', description: 'Writes the per-campaign PDF brief.', model_type: 'text', icon: FileSignature, note: null },
  { step_key: 'brand_embedding', label: 'Brand Embedding', description: 'Vector representation of your brand voice for semantic recall.', model_type: 'embedding', icon: Brain, note: null },
  { step_key: 'relevance_scoring', label: 'Relevance Scoring', description: 'Reserved for future on-demand AI rescoring of signals.', model_type: 'text', icon: Search, note: 'v1 uses zero-cost TF-IDF — this card is informational only.' },
]

const COST_LABEL: Record<string, string> = {
  free: 'Free',
  low: 'Cheap',
  medium: 'Mid',
  high: 'Premium',
  ultra: 'Top-tier',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callEdgeFunction(name: string, method: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession()
  const resp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'request_failed' }))
    throw new Error(err.error ?? 'request_failed')
  }
  return resp.json()
}

function costBadgeClass(tier: string) {
  const map: Record<string, string> = {
    free: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    high: 'bg-red-500/15 text-red-300 border-red-500/30',
    ultra: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  }
  return map[tier] ?? 'bg-slate-700 text-slate-300 border-slate-600'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RecommendationCard({ model }: { model: AvailableModel }) {
  return (
    <div className="flex-shrink-0 w-72 rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-100 leading-snug whitespace-normal">{model.model_label}</p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${costBadgeClass(model.cost_tier)}`}>
          {COST_LABEL[model.cost_tier] ?? model.cost_tier}
        </span>
      </div>
      <p className="text-xs text-slate-500">{model.provider_key} · {model.model_type}</p>
      {model.recommendation_text && (
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 whitespace-normal">{model.recommendation_text}</p>
      )}
    </div>
  )
}

function ProviderStatusPill({ provider, onClick }: { provider: Provider; onClick: () => void }) {
  const status = provider.has_org_key ? 'org' : provider.platform_key_available ? 'platform' : 'none'
  const colors = {
    org: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
    platform: 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
    none: 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700',
  }
  const labels = { org: 'Your key', platform: 'Platform key', none: 'No key' }
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-colors ${colors[status]}`}
    >
      {provider.display_name} · {labels[status]}
    </button>
  )
}

function StepCard({
  step, allModels, providers, currentPref, onChange, onSave, canEdit, isSaving, isPending,
}: {
  step: typeof STEP_CARDS[0]
  allModels: AvailableModel[]
  providers: Provider[]
  currentPref: Preference | undefined
  onChange: (pref: Preference) => void
  onSave: (stepKey: string) => void
  canEdit: boolean
  isSaving: boolean
  isPending: boolean
}) {
  const compatible = allModels.filter(m => m.compatible_step_keys?.includes(step.step_key))
  const defaultModel = allModels.find(m => Array.isArray(m.default_for_step_key) && m.default_for_step_key.includes(step.step_key))
  const selectedModelId = currentPref?.model_id ?? defaultModel?.model_id ?? ''
  const selectedModel = allModels.find(m => m.model_id === selectedModelId)
  const providerMap = new Map(providers.map(p => [p.provider_key, p]))
  const isLocked = selectedModel
    ? !providerMap.get(selectedModel.provider_key)?.has_org_key && !providerMap.get(selectedModel.provider_key)?.platform_key_available
    : false
  const isOnDefault = defaultModel?.model_id === selectedModelId

  function handleSelect(modelId: string) {
    const m = allModels.find(x => x.model_id === modelId)
    if (!m) return
    onChange({ step_key: step.step_key, provider_key: m.provider_key, model_id: m.model_id, model_label: m.model_label })
  }

  function handleReset() {
    if (!defaultModel) return
    onChange({ step_key: step.step_key, provider_key: defaultModel.provider_key, model_id: defaultModel.model_id, model_label: defaultModel.model_label })
  }

  const Icon = step.icon

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
            <Icon className="h-4 w-4 text-slate-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-100">{step.label}</h3>
              {isOnDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">Default</span>}
              {isPending && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">Unsaved</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
          </div>
        </div>
        {selectedModel && (
          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${costBadgeClass(selectedModel.cost_tier)}`}>
            {COST_LABEL[selectedModel.cost_tier] ?? selectedModel.cost_tier}
          </span>
        )}
      </div>

      {step.note && (
        <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1.5">{step.note}</p>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select value={selectedModelId} onValueChange={(v) => v && handleSelect(v)} disabled={!canEdit || compatible.length === 0}>
            <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 h-9 text-sm">
              <SelectValue placeholder={compatible.length === 0 ? 'No compatible models' : 'Select model…'}>
                {selectedModel ? (
                  <span className="flex items-center gap-2 truncate">
                    {isLocked && <Lock className="w-3 h-3 text-red-400 shrink-0" />}
                    <span className="truncate">{selectedModel.model_label}</span>
                    <span className="text-slate-500 text-xs shrink-0">· {selectedModel.provider_key}</span>
                  </span>
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 max-h-72">
              {compatible.map(m => {
                const prov = providerMap.get(m.provider_key)
                const locked = !prov?.has_org_key && !prov?.platform_key_available
                return (
                  <SelectItem key={m.model_id} value={m.model_id} className="text-slate-100 focus:bg-slate-800">
                    <span className="flex items-center gap-2">
                      {locked && <Lock className="w-3 h-3 text-red-400" />}
                      <span>{m.model_label}</span>
                      <span className="text-slate-500 text-xs">· {m.provider_key}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${costBadgeClass(m.cost_tier)}`}>
                        {COST_LABEL[m.cost_tier] ?? m.cost_tier}
                      </span>
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
        {canEdit && isPending && (
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 px-3" onClick={() => onSave(step.step_key)} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        )}
        {canEdit && !isOnDefault && !isPending && defaultModel && (
          <Button size="sm" variant="outline" className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 h-9 px-2" onClick={handleReset} title="Reset to default">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {isLocked && (
        <p className="text-[11px] text-red-300 flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3" />
          No API key for {selectedModel?.provider_key} — add one below to use this model.
        </p>
      )}
    </div>
  )
}

function ProviderKeyCard({ provider, canEdit, cardRef }: {
  provider: Provider; canEdit: boolean; cardRef?: React.RefObject<HTMLDivElement>
}) {
  const queryClient = useQueryClient()
  const [keyValue, setKeyValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const disabled = !canEdit

  const saveMutation = useMutation({
    mutationFn: () => callEdgeFunction('save-provider-keys', 'POST', { provider_key: provider.provider_key, api_key: keyValue }),
    onSuccess: () => {
      toast.success(`${provider.display_name} key saved`)
      setKeyValue('')
      queryClient.invalidateQueries({ queryKey: ['available-models'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => callEdgeFunction('delete-provider-key', 'DELETE', { provider_key: provider.provider_key }),
    onSuccess: () => {
      toast.success(`${provider.display_name} key deleted`)
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: ['available-models'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const status = provider.has_org_key ? 'org' : provider.platform_key_available ? 'platform' : 'none'
  const statusLabels = { org: 'Your key active', platform: 'Platform key active', none: 'No key' }
  const statusClass = {
    org: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    platform: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    none: 'bg-slate-800 text-slate-400 border-slate-700',
  }

  return (
    <div ref={cardRef} className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">{provider.display_name}</h3>
          {provider.docs_url && (
            <a href={provider.docs_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 mt-0.5">
              API docs <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded border ${statusClass[status]}`}>{statusLabels[status]}</span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? 'text' : 'password'}
            placeholder="Paste API key…"
            value={keyValue}
            onChange={e => setKeyValue(e.target.value)}
            disabled={disabled}
            className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 pr-9 h-9 text-sm"
          />
          <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" tabIndex={-1}>
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white h-9" onClick={() => saveMutation.mutate()} disabled={disabled || !keyValue.trim() || saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        {provider.has_org_key && (
          <Button size="sm" variant="outline" className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 h-9" onClick={() => setDeleteOpen(true)} disabled={disabled || deleteMutation.isPending}>
            Delete
          </Button>
        )}
      </div>

      <p className="text-[11px] text-slate-600">AES-256-GCM encrypted. Cannot be viewed after saving — only replaced or deleted.</p>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Delete {provider.display_name} key?</DialogTitle>
            <DialogDescription className="text-slate-400">
              The platform key will be used as a fallback if available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="text-slate-300 hover:text-slate-100" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
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
  const queryClient = useQueryClient()

  const [pendingPrefs, setPendingPrefs] = useState<Record<string, Preference>>({})
  const [savingStep, setSavingStep] = useState<string | null>(null)
  const [isSavingAll, setIsSavingAll] = useState(false)

  const providerRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({})

  // Fetch role + plan_tier directly (org store userRole is never hydrated)
  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ['models-access'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('not_authenticated')
      const orgId = (user.app_metadata as { org_id?: string })?.org_id
      if (!orgId) throw new Error('no_org')
      const [{ data: org }, { data: member }] = await Promise.all([
        supabase.from('orgs').select('plan_tier').eq('id', orgId).single(),
        supabase.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).single(),
      ])
      return {
        role: (member?.role ?? 'member') as 'owner' | 'admin' | 'member',
        planTier: (org?.plan_tier ?? 'starter') as string,
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const isAdmin = access?.role === 'admin' || access?.role === 'owner'
  const isFullySubscribed = access?.planTier === 'fully_subscribed'
  const canEdit = isAdmin && isFullySubscribed

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
      const result = await callEdgeFunction('save-model-preferences', 'POST', { preferences: [pref] })
      if (result.saved?.includes(stepKey)) {
        toast.success('Preference saved')
        setPendingPrefs(p => {
          const next = { ...p }
          delete next[stepKey]
          return next
        })
        queryClient.invalidateQueries({ queryKey: ['available-models'] })
      } else {
        const err = result.errors?.find((e: { step_key: string; reason: string }) => e.step_key === stepKey)
        toast.error(err?.reason ?? 'Save failed')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingStep(null)
    }
  }

  async function saveAllChanges() {
    const prefs = Object.values(pendingPrefs)
    if (prefs.length === 0) return
    setIsSavingAll(true)
    try {
      const result = await callEdgeFunction('save-model-preferences', 'POST', { preferences: prefs })
      toast.success(`Saved ${result.saved?.length ?? 0} preference(s)`)
      if (result.errors?.length > 0) {
        toast.warning(`${result.errors.length} error(s): ${result.errors.map((e: { reason: string }) => e.reason).join(', ')}`)
      }
      queryClient.invalidateQueries({ queryKey: ['available-models'] })
      setPendingPrefs({})
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setIsSavingAll(false)
    }
  }

  function scrollToProvider(providerKey: string) {
    providerRefs.current[providerKey]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (isLoading || accessLoading) return <SettingsModelsLoading />
  if (isError) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-100">Model Settings</h1>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-red-300">Failed to load model settings.</p>
          <Button variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800" onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    )
  }

  const pendingCount = Object.keys(pendingPrefs).length

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Model Settings</h1>
            <p className="text-slate-400 text-sm mt-1">Choose which AI model powers each generation step.</p>
          </div>
          {canEdit && pendingCount > 0 && (
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={saveAllChanges} disabled={isSavingAll}>
              {isSavingAll ? 'Saving…' : `Save all (${pendingCount})`}
            </Button>
          )}
        </div>

        {/* Lock banner */}
        {!canEdit && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100">
                {!isAdmin
                  ? 'View-only access'
                  : 'Locked on your current plan'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {!isAdmin
                  ? 'Only org owners and admins can change model settings. Contact your admin to make changes.'
                  : `Model selection and BYOK API keys are available on the Fully Subscribed plan only. You're on ${access?.planTier?.replace(/_/g, ' ') ?? 'the starter'} — using platform defaults below.`}
              </p>
            </div>
            {isAdmin && !isFullySubscribed && (
              <Link href="/settings/billing" className="shrink-0 text-xs font-medium text-indigo-300 hover:text-indigo-200 underline underline-offset-2">
                Upgrade →
              </Link>
            )}
          </div>
        )}

        {/* Recommendations */}
        {data?.recommended && data.recommended.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-slate-200">Recommended models</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {[...data.recommended]
                .sort((a, b) => (a.recommendation_order ?? 99) - (b.recommendation_order ?? 99))
                .map(m => <RecommendationCard key={m.model_id} model={m} />)}
            </div>
          </section>
        )}

        {/* Provider key status */}
        {data?.providers && data.providers.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-200">Provider keys</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.providers.map(p => <ProviderStatusPill key={p.provider_key} provider={p} onClick={() => scrollToProvider(p.provider_key)} />)}
            </div>
            <p className="text-[11px] text-slate-500">
              <span className="text-emerald-400">Your key</span> = BYOK · <span className="text-amber-400">Platform key</span> = we cover it · <span className="text-slate-500">No key</span> = locked
            </p>
          </section>
        )}

        {/* Generation steps */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-200">Generation steps</h2>
          </div>
          <div className="space-y-2.5">
            {STEP_CARDS.map(step => (
              <StepCard
                key={step.step_key}
                step={step}
                allModels={allModels}
                providers={data?.providers ?? []}
                currentPref={getCurrentPref(step.step_key)}
                onChange={pref => setPendingPrefs(p => ({ ...p, [pref.step_key]: pref }))}
                onSave={saveStep}
                canEdit={canEdit}
                isSaving={savingStep === step.step_key}
                isPending={!!pendingPrefs[step.step_key]}
              />
            ))}
          </div>
        </section>

        {/* Provider API keys */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-200">API keys</h2>
          </div>
          <div className="space-y-2.5">
            {(data?.providers ?? []).map(provider => {
              if (!providerRefs.current[provider.provider_key]) {
                providerRefs.current[provider.provider_key] = { current: null } as React.RefObject<HTMLDivElement>
              }
              return (
                <ProviderKeyCard
                  key={provider.provider_key}
                  provider={provider}
                  canEdit={canEdit}
                  cardRef={providerRefs.current[provider.provider_key]}
                />
              )
            })}
          </div>
        </section>
      </div>
  )
}

function SettingsModelsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <Skeleton className="h-8 w-48 bg-slate-800" />
      <div className="flex gap-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-72 bg-slate-800 rounded-xl shrink-0" />)}
      </div>
      <Skeleton className="h-6 w-32 bg-slate-800" />
      {[1, 2, 3, 4, 5, 6, 7].map(i => <Skeleton key={i} className="h-20 w-full bg-slate-800 rounded-xl" />)}
    </div>
  )
}
