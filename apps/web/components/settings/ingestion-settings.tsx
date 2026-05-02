'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Loader2, RefreshCw, Trash2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const FREQUENCIES = [
  { value: 'daily', label: 'Every day' },
  { value: 'every_2_days', label: 'Every 2 days' },
  { value: 'every_3_days', label: 'Every 3 days' },
  { value: 'every_5_days', label: 'Every 5 days' },
  { value: 'monthly', label: 'Every month' },
]

const DATA_SOURCE_KEYS = [
  { key: 'reddit_client_id', label: 'Reddit Client ID', group: 'Reddit' },
  { key: 'reddit_secret', label: 'Reddit Secret', group: 'Reddit' },
  { key: 'newsapi_key', label: 'NewsAPI Key', group: 'NewsAPI' },
  { key: 'twitter_bearer', label: 'Twitter Bearer Token', group: 'Twitter' },
  { key: 'youtube_api_key', label: 'YouTube API Key', group: 'YouTube' },
  { key: 'tavily_api_key', label: 'Tavily API Key', group: 'Tavily' },
  { key: 'brave_search_api_key', label: 'Brave Search API Key', group: 'Brave Search' },
  { key: 'clearbit_key', label: 'Clearbit API Key', group: 'Clearbit' },
  { key: 'apify_token', label: 'Apify Token', group: 'LinkedIn (Apify)' },
  { key: 'github_token', label: 'GitHub Token', group: 'GitHub' },
]

interface IngestionSettingsProps {
  initialEnabled: boolean
  initialFrequency: string
  lastIngestionAt: string | null
  existingKeys: string[]
  isAdmin: boolean
}

async function callEdgeFunction(path: string, body: unknown, method = 'POST') {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Unknown error')
  }
  return res.json()
}

export function IngestionSettings({
  initialEnabled,
  initialFrequency,
  lastIngestionAt,
  existingKeys,
  isAdmin,
}: IngestionSettingsProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [frequency, setFrequency] = useState(initialFrequency || 'daily')
  const [lastAt, setLastAt] = useState(lastIngestionAt)
  const [isFetching, startFetching] = useTransition()
  const [isToggling, startToggling] = useTransition()
  const [keyValues, setKeyValues] = useState<Record<string, string>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set(existingKeys))
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [linkedInConsent, setLinkedInConsent] = useState(false)

  async function handleToggle(newEnabled: boolean) {
    startToggling(async () => {
      try {
        const result = await callEdgeFunction('update-org-settings', {
          signal_ingestion_enabled: newEnabled,
        })
        setEnabled(newEnabled)
        if (result.triggered_immediate_ingest) {
          toast.success('Ingestion started! Signals will appear within 15 minutes.')
        }
      } catch (err) {
        toast.error(`Failed to update: ${err}`)
      }
    })
  }

  async function handleFrequencyChange(newFreq: string) {
    setFrequency(newFreq)
    try {
      await callEdgeFunction('update-org-settings', { signal_ingestion_frequency: newFreq })
      toast.success('Frequency saved')
    } catch (err) {
      toast.error(`Failed to save frequency: ${err}`)
    }
  }

  function handleFetchNow() {
    startFetching(async () => {
      try {
        await callEdgeFunction('update-org-settings', { signal_ingestion_enabled: true })
        setLastAt(new Date().toISOString())
        toast.success('Fetch triggered — signals updating now')
      } catch (err) {
        toast.error(`Fetch failed: ${err}`)
      }
    })
  }

  async function handleSaveKey(keyName: string) {
    const value = keyValues[keyName]?.trim()
    if (!value) return toast.error('Enter a value first')
    setSavingKey(keyName)
    try {
      await callEdgeFunction('save-data-source-key', { key_name: keyName, value })
      setSavedKeys((prev) => new Set([...prev, keyName]))
      setKeyValues((prev) => ({ ...prev, [keyName]: '' }))
      toast.success('Key saved')
    } catch (err) {
      toast.error(`Failed to save: ${err}`)
    } finally {
      setSavingKey(null)
    }
  }

  async function handleDeleteKey(keyName: string) {
    if (!confirm(`Delete the ${keyName} key? Any feed configs using this key will be paused.`)) return
    setDeletingKey(keyName)
    try {
      await callEdgeFunction('delete-data-source-key', { key_name: keyName }, 'DELETE')
      setSavedKeys((prev) => { const s = new Set(prev); s.delete(keyName); return s })
      toast.success('Key deleted')
    } catch (err) {
      toast.error(`Failed to delete: ${err}`)
    } finally {
      setDeletingKey(null)
    }
  }

  const disabled = !isAdmin

  // Group keys by group name
  const keyGroups = DATA_SOURCE_KEYS.reduce<Record<string, typeof DATA_SOURCE_KEYS>>((acc, k) => {
    if (!acc[k.group]) acc[k.group] = []
    acc[k.group].push(k)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Ingestion Toggle */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-100">Signal Ingestion</CardTitle>
          <CardDescription className="text-slate-400">
            Automatically fetch market signals from your configured data sources.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-100 font-medium">Automatically fetch signals</p>
              <p className="text-slate-400 text-sm mt-0.5">
                {enabled
                  ? lastAt
                    ? `Last fetched ${formatDistanceToNow(new Date(lastAt), { addSuffix: true })}`
                    : 'Never fetched yet'
                  : 'Signal ingestion is paused'}
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={disabled || isToggling}
            />
          </div>

          {!enabled && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-400 text-sm">
              Signal ingestion is paused. Turn it on to start receiving trend signals.
            </div>
          )}

          {/* Frequency selector */}
          {enabled && (
            <div className="space-y-3">
              <Separator className="bg-slate-800" />
              <Label className="text-slate-300">Fetch frequency</Label>
              <div className="flex flex-wrap gap-2">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => !disabled && handleFrequencyChange(f.value)}
                    disabled={disabled}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      frequency === f.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Fetch Now */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchNow}
                disabled={disabled || isFetching}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                {isFetching ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Fetching signals...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Fetch now</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Source API Keys */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-100">Data Source API Keys</CardTitle>
          <CardDescription className="text-slate-400">
            Add optional API keys to unlock more signal sources. Keys are encrypted and never exposed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* LinkedIn consent card first */}
          <div className="rounded-lg border border-slate-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-slate-100 font-medium">LinkedIn (via Apify)</p>
              {savedKeys.has('apify_token')
                ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Key set</Badge>
                : <Badge variant="outline" className="border-slate-700 text-slate-400">Not configured</Badge>
              }
            </div>
            {!linkedInConsent ? (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkedInConsent}
                  onChange={(e) => setLinkedInConsent(e.target.checked)}
                  disabled={disabled}
                  className="mt-0.5 accent-indigo-500"
                />
                <span className="text-slate-400 text-sm">
                  I understand LinkedIn data is fetched via a third-party scraper (Apify) and raw data is not retained beyond 24 hours.
                </span>
              </label>
            ) : (
              <KeyInput
                keyName="apify_token"
                label="Apify Token"
                value={keyValues['apify_token'] || ''}
                onChange={(v) => setKeyValues((p) => ({ ...p, apify_token: v }))}
                show={showKey['apify_token'] || false}
                onToggleShow={() => setShowKey((p) => ({ ...p, apify_token: !p.apify_token }))}
                isSaved={savedKeys.has('apify_token')}
                isSaving={savingKey === 'apify_token'}
                isDeleting={deletingKey === 'apify_token'}
                disabled={disabled}
                onSave={() => handleSaveKey('apify_token')}
                onDelete={() => handleDeleteKey('apify_token')}
              />
            )}
          </div>

          {/* All other keys by group */}
          {Object.entries(keyGroups)
            .filter(([group]) => group !== 'LinkedIn (Apify)')
            .map(([group, keys]) => (
              <div key={group} className="rounded-lg border border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-slate-100 font-medium">{group}</p>
                  {keys.every((k) => savedKeys.has(k.key))
                    ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Key set</Badge>
                    : <Badge variant="outline" className="border-slate-700 text-slate-400">Not configured</Badge>
                  }
                </div>
                {keys.map((k) => (
                  <KeyInput
                    key={k.key}
                    keyName={k.key}
                    label={k.label}
                    value={keyValues[k.key] || ''}
                    onChange={(v) => setKeyValues((p) => ({ ...p, [k.key]: v }))}
                    show={showKey[k.key] || false}
                    onToggleShow={() => setShowKey((p) => ({ ...p, [k.key]: !p[k.key] }))}
                    isSaved={savedKeys.has(k.key)}
                    isSaving={savingKey === k.key}
                    isDeleting={deletingKey === k.key}
                    disabled={disabled}
                    onSave={() => handleSaveKey(k.key)}
                    onDelete={() => handleDeleteKey(k.key)}
                  />
                ))}
              </div>
            ))}

          {disabled && (
            <p className="text-slate-500 text-sm text-center">
              Contact your admin to change API key settings.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KeyInput({
  keyName, label, value, onChange, show, onToggleShow,
  isSaved, isSaving, isDeleting, disabled, onSave, onDelete,
}: {
  keyName: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  isSaved: boolean
  isSaving: boolean
  isDeleting: boolean
  disabled: boolean
  onSave: () => void
  onDelete: () => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={keyName} className="text-slate-400 text-sm">{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={keyName}
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isSaved ? '••••••••' : 'Paste key here'}
            disabled={disabled}
            className="bg-slate-800 border-slate-700 text-slate-100 pr-10 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button
          size="sm"
          onClick={onSave}
          disabled={disabled || isSaving || !value.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 shrink-0"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isSaved ? <CheckCircle2 className="h-4 w-4" /> : 'Save'}
        </Button>
        {isSaved && (
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={disabled || isDeleting}
            className="border-red-900 text-red-400 hover:bg-red-900/20 shrink-0"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}
