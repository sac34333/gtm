'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  COUNTRIES, INDUSTRIES, COMPANY_SIZES, ICP_COMPANY_SIZES,
  REVENUE_MODELS, PLATFORMS, TIMEZONES,
} from '@/lib/constants'
import { BrandFileUpload } from './brand-file-upload'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// ─── Types ────────────────────────────────────────────────────────────────

interface BrandColours { primary: string; secondary: string; accent: string }
interface ProductService { name: string; description: string }

// Loose row type — all columns nullable from DB
type BrandRow = Record<string, unknown>

// ─── Helpers ──────────────────────────────────────────────────────────────

async function callSave(payload: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not signed in')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/save-onboarding`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error ?? 'Save failed')
  }
  return res.json()
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function asNumber(v: unknown, fallback = 50): number {
  return typeof v === 'number' ? v : fallback
}
function asArray<T = string>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

// ─── Reusable bits ────────────────────────────────────────────────────────

function Card({
  title, description, defaultOpen = false, children,
}: {
  title: string; description: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-900/60 transition"
      >
        <div className="text-left">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-white/[0.04] space-y-5">{children}</div>}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-300">{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function FieldSelect({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[] | string[]
  placeholder?: string
}) {
  const opts = options.map(o => typeof o === 'string' ? { value: o, label: o } : o)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function MultiSelect({
  options, selected, onChange,
}: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(val: string) {
    if (selected.includes(val)) onChange(selected.filter(s => s !== val))
    else onChange([...selected, val])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            selected.includes(opt)
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-slate-200'
          }`}
        >{opt}</button>
      ))}
    </div>
  )
}

function TagInput({
  tags, onChange, placeholder, max,
}: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string; max: number }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (!v || tags.includes(v) || tags.length >= max) return
    onChange([...tags, v]); setInput('')
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
        />
        <Button
          type="button" variant="outline" onClick={add} disabled={tags.length >= max}
          className="border-slate-700 text-slate-300 hover:bg-slate-700 shrink-0"
        >Add</Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-900/60 text-indigo-300 border border-indigo-700">
              {t}
              <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} className="hover:text-white ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">{tags.length}/{max}</p>
    </div>
  )
}

function ToneSlider({
  label, leftLabel, rightLabel, value, onChange,
}: { label: string; leftLabel: string; rightLabel: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-slate-300 text-sm">{label}</Label>
        <span className="text-xs text-slate-500">{value}</span>
      </div>
      <input
        type="range" min={0} max={100} step={1}
        value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500"
      />
      <div className="flex justify-between text-xs text-slate-500">
        <span>{leftLabel}</span><span>{rightLabel}</span>
      </div>
    </div>
  )
}

function SaveBar({
  isPending, onSave, dirty,
}: { isPending: boolean; onSave: () => void; dirty: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.04]">
      {dirty && !isPending && <span className="text-xs text-amber-400">Unsaved changes</span>}
      <Button
        type="button" onClick={onSave} disabled={isPending || !dirty}
        className="bg-indigo-600 hover:bg-indigo-500 text-white"
      >{isPending ? 'Saving…' : 'Save changes'}</Button>
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────

export function BrandSettingsForm({
  initial,
  logoSignedUrl,
  guidelinesSignedUrl,
}: {
  initial: BrandRow
  logoSignedUrl?: string | null
  guidelinesSignedUrl?: string | null
}) {
  // Local state for current file paths (so UI updates after upload/remove without full reload)
  const [logoPath, setLogoPath] = useState<string>(asString(initial.logo_url))
  const [guidelinesPath, setGuidelinesPath] = useState<string>(asString(initial.brand_guidelines_url))

  async function persistFile(field: 'logo_url' | 'brand_guidelines_url', value: string) {
    // Empty string clears the field
    await callSave({ [field]: value || null })
    if (field === 'logo_url') setLogoPath(value)
    else setGuidelinesPath(value)
  }

  // ── Section 1: Company identity ──
  const [s1, setS1] = useState({
    company_name: asString(initial.company_name),
    country_code: asString(initial.country_code),
    industry_sector: asString(initial.industry_sector),
    company_size: asString(initial.company_size),
    website_url: asString(initial.website_url),
    founding_year: initial.founding_year ? String(initial.founding_year) : '',
    one_sentence_pitch: asString(initial.one_sentence_pitch),
    extended_description: asString(initial.extended_description),
    differentiators: asArray<string>(initial.differentiators),
    proof_points: asArray<string>(initial.proof_points),
    products_services: (asArray<ProductService>(initial.products_services).length > 0
      ? asArray<ProductService>(initial.products_services)
      : [{ name: '', description: '' }]),
    revenue_model: asString(initial.revenue_model),
    target_geographies: asArray<string>(initial.target_geographies),
    target_industries: asArray<string>(initial.target_industries),
    target_company_sizes: asArray<string>(initial.target_company_sizes),
    decision_maker_titles: asArray<string>(initial.decision_maker_titles),
  })
  const [s1Dirty, setS1Dirty] = useState(false)

  // ── Section 2: Voice & tone ──
  const [s2, setS2] = useState({
    tone_formal_conversational: asNumber(initial.tone_formal_conversational),
    tone_safe_bold: asNumber(initial.tone_safe_bold),
    tone_corporate_human: asNumber(initial.tone_corporate_human),
    tone_data_story: asNumber(initial.tone_data_story),
    tone_conservative_provocative: asNumber(initial.tone_conservative_provocative),
    sentence_length: asString(initial.sentence_length, 'medium'),
    jargon_level: asString(initial.jargon_level, 'moderate'),
    emoji_usage: asString(initial.emoji_usage, 'sparingly'),
    cta_style: asString(initial.cta_style, 'direct'),
    voice_examples: (() => {
      const arr = asArray<string>(initial.voice_examples)
      return [arr[0] ?? '', arr[1] ?? '', arr[2] ?? '']
    })(),
  })
  const [s2Dirty, setS2Dirty] = useState(false)

  // ── Section 3: Visual identity ──
  const defaultColours: BrandColours = { primary: '#6366f1', secondary: '#8b5cf6', accent: '#06b6d4' }
  const initColours = (initial.brand_colours && typeof initial.brand_colours === 'object'
    ? { ...defaultColours, ...(initial.brand_colours as Partial<BrandColours>) }
    : defaultColours)
  const [s3, setS3] = useState({
    brand_colours: initColours,
    visual_style: asString(initial.visual_style),
    dark_light_preference: asString(initial.dark_light_preference),
    busy_minimal: asString(initial.busy_minimal),
    human_faces: typeof initial.human_faces === 'boolean' ? (initial.human_faces ? 'yes' : 'no') : '',
    location_style: asString(initial.location_style),
  })
  const [s3Dirty, setS3Dirty] = useState(false)

  // ── Section 4: Content strategy ──
  const [s4, setS4] = useState({
    active_themes: asArray<string>(initial.active_themes),
    competitor_names: asArray<string>(initial.competitor_names),
    primary_platform: asString(initial.primary_platform, 'linkedin'),
    secondary_platform: asString(initial.secondary_platform),
    posts_per_week: typeof initial.posts_per_week === 'number' ? String(initial.posts_per_week) : '3',
    timezone: asString(initial.timezone, 'Europe/London'),
    topics_to_avoid: asArray<string>(initial.topics_to_avoid),
  })
  const [s4Dirty, setS4Dirty] = useState(false)

  // ── Section 5: Compliance ──
  const [s5, setS5] = useState({
    phrases_to_avoid: asArray<string>(initial.phrases_to_avoid),
    visual_styles_to_avoid: (() => {
      const arr = asArray<string>(initial.visual_styles_to_avoid)
      return arr[0] ?? ''
    })(),
    sensitivities: asString(initial.sensitivities),
  })
  const [s5Dirty, setS5Dirty] = useState(false)

  const [isPending, startTransition] = useTransition()

  function update<T extends object>(setter: (v: T) => void, dirtySetter: (d: boolean) => void, current: T) {
    return (patch: Partial<T>) => {
      setter({ ...current, ...patch })
      dirtySetter(true)
    }
  }
  const u1 = update(setS1, setS1Dirty, s1)
  const u2 = update(setS2, setS2Dirty, s2)
  const u3 = update(setS3, setS3Dirty, s3)
  const u4 = update(setS4, setS4Dirty, s4)
  const u5 = update(setS5, setS5Dirty, s5)

  function save(payload: Record<string, unknown>, onSuccess: () => void) {
    startTransition(async () => {
      try {
        await callSave(payload)
        toast.success('Saved')
        onSuccess()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  // Section 1 save
  function saveS1() {
    if (!s1.company_name.trim()) { toast.error('Company name is required'); return }
    const validProducts = s1.products_services.filter(p => p.name.trim())
    save({
      company_name: s1.company_name.trim(),
      country_code: s1.country_code,
      industry_sector: s1.industry_sector,
      company_size: s1.company_size,
      website_url: s1.website_url.trim() || undefined,
      founding_year: s1.founding_year ? Number(s1.founding_year) : undefined,
      one_sentence_pitch: s1.one_sentence_pitch.trim(),
      extended_description: s1.extended_description.trim() || undefined,
      differentiators: s1.differentiators,
      proof_points: s1.proof_points,
      products_services: validProducts.length > 0 ? validProducts : undefined,
      revenue_model: s1.revenue_model || undefined,
      target_geographies: s1.target_geographies,
      target_industries: s1.target_industries,
      target_company_sizes: s1.target_company_sizes,
      decision_maker_titles: s1.decision_maker_titles,
    }, () => setS1Dirty(false))
  }

  function saveS2() {
    save({
      tone_formal_conversational: s2.tone_formal_conversational,
      tone_safe_bold: s2.tone_safe_bold,
      tone_corporate_human: s2.tone_corporate_human,
      tone_data_story: s2.tone_data_story,
      tone_conservative_provocative: s2.tone_conservative_provocative,
      sentence_length: s2.sentence_length,
      jargon_level: s2.jargon_level,
      emoji_usage: s2.emoji_usage,
      cta_style: s2.cta_style,
      voice_examples: s2.voice_examples.filter(e => e.trim()),
    }, () => setS2Dirty(false))
  }

  function saveS3() {
    save({
      brand_colours: s3.brand_colours,
      visual_style: s3.visual_style || undefined,
      dark_light_preference: s3.dark_light_preference || undefined,
      busy_minimal: s3.busy_minimal || undefined,
      human_faces: s3.human_faces ? !['no'].includes(s3.human_faces) : undefined,
      location_style: s3.location_style || undefined,
    }, () => setS3Dirty(false))
  }

  function saveS4() {
    save({
      active_themes: s4.active_themes,
      competitor_names: s4.competitor_names,
      primary_platform: s4.primary_platform,
      secondary_platform: s4.secondary_platform || undefined,
      posts_per_week: Number(s4.posts_per_week),
      timezone: s4.timezone,
      topics_to_avoid: s4.topics_to_avoid,
    }, () => setS4Dirty(false))
  }

  function saveS5() {
    save({
      phrases_to_avoid: s5.phrases_to_avoid,
      visual_styles_to_avoid: s5.visual_styles_to_avoid.trim() ? [s5.visual_styles_to_avoid.trim()] : [],
      sensitivities: s5.sensitivities.trim() || undefined,
    }, () => setS5Dirty(false))
  }

  // Section 1 product helpers
  function addProduct() {
    if (s1.products_services.length < 5)
      u1({ products_services: [...s1.products_services, { name: '', description: '' }] })
  }
  function removeProduct(i: number) {
    u1({ products_services: s1.products_services.filter((_, idx) => idx !== i) })
  }
  function updateProduct(i: number, field: keyof ProductService, value: string) {
    const arr = [...s1.products_services]
    arr[i] = { ...arr[i], [field]: value }
    u1({ products_services: arr })
  }

  return (
    <div className="space-y-4">
      {/* ── Section 1: Company identity ── */}
      <Card title="Company identity" description="Who you are and who you sell to" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company name">
            <Input
              value={s1.company_name}
              onChange={e => u1({ company_name: e.target.value })}
              maxLength={200}
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </Field>
          <Field label="Country / region">
            <FieldSelect
              value={s1.country_code}
              onChange={v => u1({ country_code: v })}
              options={COUNTRIES.map(c => ({ value: c.code, label: c.name }))}
              placeholder="Select country…"
            />
          </Field>
          <Field label="Industry sector">
            <FieldSelect
              value={s1.industry_sector}
              onChange={v => u1({ industry_sector: v })}
              options={INDUSTRIES}
              placeholder="Select industry…"
            />
          </Field>
          <Field label="Company size">
            <FieldSelect
              value={s1.company_size}
              onChange={v => u1({ company_size: v })}
              options={COMPANY_SIZES}
              placeholder="Select size…"
            />
          </Field>
          <Field label="Website URL">
            <Input
              value={s1.website_url}
              onChange={e => u1({ website_url: e.target.value })}
              type="url" placeholder="https://acme.com"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </Field>
          <Field label="Founding year">
            <Input
              value={s1.founding_year}
              onChange={e => u1({ founding_year: e.target.value })}
              type="number" min={1800} max={2100}
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </Field>
        </div>

        <Field label="One-sentence pitch" hint={`${s1.one_sentence_pitch.length}/200`}>
          <Textarea
            value={s1.one_sentence_pitch}
            onChange={e => u1({ one_sentence_pitch: e.target.value })}
            maxLength={200} rows={2}
            className="bg-slate-800 border-slate-700 text-slate-100 resize-none"
          />
        </Field>

        <Field label="Extended description" hint="3–5 sentences">
          <Textarea
            value={s1.extended_description}
            onChange={e => u1({ extended_description: e.target.value })}
            maxLength={2000} rows={4}
            className="bg-slate-800 border-slate-700 text-slate-100 resize-none"
          />
        </Field>

        <Field
          label="Differentiators"
          hint="Why you win vs alternatives. 1 line each. Used to anchor every campaign’s positioning."
        >
          <TagInput
            tags={s1.differentiators}
            onChange={v => u1({ differentiators: v })}
            placeholder='e.g. "Unlike Apollo, we sell signals, not stale data"'
            max={5}
          />
        </Field>

        <Field
          label="Proof points"
          hint="Outcomes, metrics, named customers. 1 line each. Used as evidence in posts/emails."
        >
          <TagInput
            tags={s1.proof_points}
            onChange={v => u1({ proof_points: v })}
            placeholder='e.g. "Cut SDR cost 60% at QUONSCIOUS"'
            max={5}
          />
        </Field>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-slate-300">Products / services</Label>
            <span className="text-xs text-slate-500">Up to 5</span>
          </div>
          {s1.products_services.map((ps, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start">
              <Input value={ps.name} onChange={e => updateProduct(i, 'name', e.target.value)}
                placeholder="Product name" maxLength={100}
                className="bg-slate-800 border-slate-700 text-slate-100" />
              <Input value={ps.description} onChange={e => updateProduct(i, 'description', e.target.value)}
                placeholder="Short description" maxLength={500}
                className="bg-slate-800 border-slate-700 text-slate-100" />
              {s1.products_services.length > 1 && (
                <button type="button" onClick={() => removeProduct(i)}
                  className="text-slate-500 hover:text-red-400 text-lg leading-none mt-2" aria-label="Remove">×</button>
              )}
            </div>
          ))}
          {s1.products_services.length < 5 && (
            <button type="button" onClick={addProduct} className="text-indigo-400 text-sm hover:underline">
              + Add another product
            </button>
          )}
        </div>

        <Field label="Revenue model">
          <FieldSelect value={s1.revenue_model} onChange={v => u1({ revenue_model: v })}
            options={REVENUE_MODELS} placeholder="Select model…" />
        </Field>

        <div className="pt-2 border-t border-slate-800 space-y-5">
          <p className="text-sm text-slate-400 font-medium">Who you sell to (ICP)</p>
          <Field label="Target geographies">
            <MultiSelect options={COUNTRIES.map(c => c.name)}
              selected={s1.target_geographies} onChange={v => u1({ target_geographies: v })} />
          </Field>
          <Field label="Target industries">
            <MultiSelect options={INDUSTRIES}
              selected={s1.target_industries} onChange={v => u1({ target_industries: v })} />
          </Field>
          <Field label="Target company sizes">
            <MultiSelect options={ICP_COMPANY_SIZES}
              selected={s1.target_company_sizes} onChange={v => u1({ target_company_sizes: v })} />
          </Field>
          <Field label="Primary decision-maker titles">
            <TagInput tags={s1.decision_maker_titles}
              onChange={v => u1({ decision_maker_titles: v })}
              placeholder="e.g. VP Marketing" max={5} />
          </Field>
        </div>

        <SaveBar isPending={isPending} onSave={saveS1} dirty={s1Dirty} />
      </Card>

      {/* ── Section 2: Voice & tone ── */}
      <Card title="Voice & tone" description="How your brand communicates">
        <div className="space-y-5 bg-slate-900/40 rounded-xl p-5 border border-slate-800">
          <p className="text-sm font-medium text-slate-300">Tone sliders</p>
          <ToneSlider label="Communication style" leftLabel="Conversational" rightLabel="Formal"
            value={s2.tone_formal_conversational} onChange={v => u2({ tone_formal_conversational: v })} />
          <ToneSlider label="Risk appetite" leftLabel="Safe & conservative" rightLabel="Bold & daring"
            value={s2.tone_safe_bold} onChange={v => u2({ tone_safe_bold: v })} />
          <ToneSlider label="Brand personality" leftLabel="Human & warm" rightLabel="Corporate & polished"
            value={s2.tone_corporate_human} onChange={v => u2({ tone_corporate_human: v })} />
          <ToneSlider label="Content style" leftLabel="Story-led" rightLabel="Data-driven"
            value={s2.tone_data_story} onChange={v => u2({ tone_data_story: v })} />
          <ToneSlider label="Provocation level" leftLabel="Conservative" rightLabel="Provocative"
            value={s2.tone_conservative_provocative} onChange={v => u2({ tone_conservative_provocative: v })} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Sentence length">
            <FieldSelect value={s2.sentence_length} onChange={v => u2({ sentence_length: v })}
              options={[
                { value: 'short', label: 'Short — punchy, <15 words' },
                { value: 'medium', label: 'Medium — 15–25 words' },
                { value: 'long', label: 'Long — detailed, 25+ words' },
              ]} />
          </Field>
          <Field label="Industry jargon">
            <FieldSelect value={s2.jargon_level} onChange={v => u2({ jargon_level: v })}
              options={[
                { value: 'avoid', label: 'Avoid — plain English only' },
                { value: 'moderate', label: 'Moderate — some terminology OK' },
                { value: 'heavy', label: 'Heavy — expert audience' },
              ]} />
          </Field>
          <Field label="Emoji usage">
            <FieldSelect value={s2.emoji_usage} onChange={v => u2({ emoji_usage: v })}
              options={[
                { value: 'never', label: 'Never' },
                { value: 'sparingly', label: 'Sparingly — 1-2 per post' },
                { value: 'freely', label: 'Freely — wherever natural' },
              ]} />
          </Field>
          <Field label="Call-to-action style">
            <FieldSelect value={s2.cta_style} onChange={v => u2({ cta_style: v })}
              options={[
                { value: 'soft', label: 'Soft — invite to learn more' },
                { value: 'direct', label: 'Direct — clear action' },
                { value: 'urgent', label: 'Urgent — time-sensitive push' },
              ]} />
          </Field>
        </div>

        <div className="space-y-3">
          <Label className="text-slate-300">
            Voice examples
            <span className="text-slate-500 font-normal ml-2 text-xs">Optional — up to 3 samples</span>
          </Label>
          {s2.voice_examples.map((ex, i) => (
            <Textarea key={i} value={ex}
              onChange={e => {
                const arr = [...s2.voice_examples]; arr[i] = e.target.value
                u2({ voice_examples: arr })
              }}
              maxLength={2000} rows={3}
              placeholder={`Example ${i + 1} — paste a LinkedIn post, email, or tweet…`}
              className="bg-slate-800 border-slate-700 text-slate-100 resize-none" />
          ))}
        </div>

        <SaveBar isPending={isPending} onSave={saveS2} dirty={s2Dirty} />
      </Card>

      {/* ── Section 3: Visual identity ── */}
      <Card title="Visual identity" description="Logo, colours, and image style">
        <BrandFileUpload
          kind="logo"
          label="Brand logo"
          description="Stored for reference. Not yet composited onto generated images — used for future brand-overlay features."
          currentPath={logoPath || null}
          currentSignedUrl={logoSignedUrl ?? null}
          onUploaded={(path) => persistFile('logo_url', path)}
        />

        <div className="space-y-3">
          <Label className="text-slate-300">Brand colours</Label>
          <div className="grid grid-cols-3 gap-3">
            {(['primary', 'secondary', 'accent'] as const).map(key => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs text-slate-400 capitalize">{key}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={s3.brand_colours[key]}
                    onChange={e => u3({ brand_colours: { ...s3.brand_colours, [key]: e.target.value } })}
                    className="h-8 w-10 rounded cursor-pointer bg-slate-800 border border-slate-700" />
                  <Input value={s3.brand_colours[key]}
                    onChange={e => u3({ brand_colours: { ...s3.brand_colours, [key]: e.target.value } })}
                    maxLength={20}
                    className="bg-slate-800 border-slate-700 text-slate-100 text-xs font-mono" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Visual style">
            <FieldSelect value={s3.visual_style} onChange={v => u3({ visual_style: v })}
              options={[
                { value: 'photography', label: 'Photography — realistic' },
                { value: 'editorial', label: 'Editorial — magazine-style' },
                { value: 'corporate', label: 'Corporate — clean & professional' },
                { value: 'modern_minimal', label: 'Modern minimal' },
                { value: 'illustration', label: 'Illustration' },
                { value: 'iso_illustration', label: 'Isometric illustration' },
                { value: 'flat_vector', label: 'Flat vector' },
                { value: 'abstract', label: 'Abstract' },
                { value: 'gradient_mesh', label: 'Gradient mesh' },
                { value: '3d_render', label: '3D render' },
                { value: 'data_viz', label: 'Data visualisation' },
                { value: 'screenshot', label: 'Product screenshot mockup' },
                { value: 'documentary', label: 'Documentary photography' },
                { value: 'cinematic', label: 'Cinematic' },
                { value: 'mixed_media', label: 'Mixed media' },
              ]}
              placeholder="Select style…" />
          </Field>
          <Field label="Dark / light preference">
            <FieldSelect value={s3.dark_light_preference} onChange={v => u3({ dark_light_preference: v })}
              options={[
                { value: 'dark', label: 'Dark — bold & premium' },
                { value: 'mostly_dark', label: 'Mostly dark with light accents' },
                { value: 'light', label: 'Light — clean & airy' },
                { value: 'mostly_light', label: 'Mostly light with dark accents' },
                { value: 'high_contrast', label: 'High contrast' },
                { value: 'neutral', label: 'Neutral' },
                { value: 'monochrome', label: 'Monochrome' },
              ]}
              placeholder="Select preference…" />
          </Field>
          <Field label="Composition style">
            <FieldSelect value={s3.busy_minimal} onChange={v => u3({ busy_minimal: v })}
              options={[
                { value: 'minimal', label: 'Minimal — lots of whitespace' },
                { value: 'clean', label: 'Clean — focused single subject' },
                { value: 'balanced', label: 'Balanced — symmetric layout' },
                { value: 'asymmetric', label: 'Asymmetric — modern' },
                { value: 'layered', label: 'Layered — depth' },
                { value: 'grid', label: 'Grid-based' },
                { value: 'busy', label: 'Busy — rich detail' },
                { value: 'editorial_layout', label: 'Editorial layout' },
              ]}
              placeholder="Select composition…" />
          </Field>
          <Field label="Human faces in imagery">
            <FieldSelect value={s3.human_faces} onChange={v => u3({ human_faces: v })}
              options={[
                { value: 'yes', label: 'Yes — feature people' },
                { value: 'no', label: 'No — no people' },
              ]}
              placeholder="Select…" />
          </Field>
          <Field label="Location style">
            <Input value={s3.location_style}
              onChange={e => u3({ location_style: e.target.value })}
              placeholder="e.g. modern office, outdoor, abstract"
              className="bg-slate-800 border-slate-700 text-slate-100" />
          </Field>
        </div>

        <SaveBar isPending={isPending} onSave={saveS3} dirty={s3Dirty} />
      </Card>

      {/* ── Section 4: Content strategy ── */}
      <Card title="Content strategy" description="Themes, competitors, and posting cadence">
        <Field label="Active themes" hint="Topics you actively post about">
          <TagInput tags={s4.active_themes} onChange={v => u4({ active_themes: v })}
            placeholder="e.g. AI productivity" max={10} />
        </Field>
        <Field label="Competitor names" hint="So we can avoid copying their voice">
          <TagInput tags={s4.competitor_names} onChange={v => u4({ competitor_names: v })}
            placeholder="e.g. HubSpot" max={10} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Primary platform">
            <FieldSelect value={s4.primary_platform} onChange={v => u4({ primary_platform: v })}
              options={PLATFORMS} />
          </Field>
          <Field label="Secondary platform">
            <FieldSelect value={s4.secondary_platform} onChange={v => u4({ secondary_platform: v })}
              options={PLATFORMS} placeholder="None" />
          </Field>
          <Field label="Target posts per week">
            <Input value={s4.posts_per_week}
              onChange={e => u4({ posts_per_week: e.target.value })}
              type="number" min={1} max={50}
              className="bg-slate-800 border-slate-700 text-slate-100" />
          </Field>
          <Field label="Timezone">
            <FieldSelect value={s4.timezone} onChange={v => u4({ timezone: v })}
              options={TIMEZONES} />
          </Field>
        </div>

        <Field label="Topics to avoid">
          <TagInput tags={s4.topics_to_avoid} onChange={v => u4({ topics_to_avoid: v })}
            placeholder="e.g. politics" max={10} />
        </Field>

        <SaveBar isPending={isPending} onSave={saveS4} dirty={s4Dirty} />
      </Card>

      {/* ── Section 5: Compliance ── */}
      <Card title="Compliance & guardrails" description="Brand guidelines, phrases, visuals, and topics to avoid">
        <BrandFileUpload
          kind="pdf"
          label="Brand guidelines (PDF)"
          description="We extract the text and inject a snippet into AI prompts to keep generated content on-brand."
          currentPath={guidelinesPath || null}
          currentSignedUrl={guidelinesSignedUrl ?? null}
          onUploaded={(path) => persistFile('brand_guidelines_url', path)}
        />

        <Field label="Phrases to avoid" hint="Banned words or marketing clichés">
          <TagInput tags={s5.phrases_to_avoid} onChange={v => u5({ phrases_to_avoid: v })}
            placeholder="e.g. game-changer" max={20} />
        </Field>
        <Field label="Visual styles to avoid">
          <Textarea value={s5.visual_styles_to_avoid}
            onChange={e => u5({ visual_styles_to_avoid: e.target.value })}
            maxLength={500} rows={3}
            placeholder="e.g. clip-art, stock photos of handshakes…"
            className="bg-slate-800 border-slate-700 text-slate-100 resize-none" />
        </Field>
        <Field label="Cultural / regulatory sensitivities">
          <Textarea value={s5.sensitivities}
            onChange={e => u5({ sensitivities: e.target.value })}
            maxLength={1000} rows={3}
            placeholder="e.g. avoid claims of guaranteed returns (financial), no medical advice…"
            className="bg-slate-800 border-slate-700 text-slate-100 resize-none" />
        </Field>

        <SaveBar isPending={isPending} onSave={saveS5} dirty={s5Dirty} />
      </Card>
    </div>
  )
}
