'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  COUNTRIES,
  INDUSTRIES,
  COMPANY_SIZES,
  ICP_COMPANY_SIZES,
  REVENUE_MODELS,
  PLATFORMS,
  TIMEZONES,
} from '@/lib/constants'

// ─── Types ─────────────────────────────────────────────────────────────────

type Section = 1 | 2 | 3 | 4 | 5

interface ProductService {
  name: string
  description: string
}

interface BrandColours {
  primary: string
  secondary: string
  accent: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

async function callSaveOnboarding(payload: Record<string, unknown>, accessToken: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/save-onboarding`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error ?? 'Save failed')
  }
  return res.json()
}

// ─── Progress bar ──────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: Section; total: number }) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-400 mb-2">
        <span>Step {current} of {total}</span>
        <span>{Math.round((current / total) * 100)}% complete</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

// ─── Tag input ─────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
  placeholder,
  max,
  label,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  max: number
  label?: string
}) {
  const [input, setInput] = useState('')

  function add() {
    const value = input.trim()
    if (!value || tags.includes(value) || tags.length >= max) return
    onChange([...tags, value])
    setInput('')
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div className="space-y-2">
      {label && <Label className="text-slate-300">{label}</Label>}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add() }
          }}
          placeholder={placeholder}
          className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
        />
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={tags.length >= max}
          className="border-slate-700 text-slate-300 hover:bg-slate-700 shrink-0"
        >
          Add
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-900/60 text-indigo-300 border border-indigo-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="hover:text-white ml-0.5"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">{tags.length}/{max} added</p>
    </div>
  )
}

// ─── Slider ────────────────────────────────────────────────────────────────

function ToneSlider({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  label: string
  leftLabel: string
  rightLabel: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-slate-300 text-sm">{label}</Label>
        <span className="text-xs text-slate-500">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500"
      />
      <div className="flex justify-between text-xs text-slate-500">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}

// ─── MultiSelect ──────────────────────────────────────────────────────────

function MultiSelect({
  options,
  selected,
  onChange,
  label,
}: {
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  label?: string
}) {
  function toggle(val: string) {
    if (selected.includes(val)) {
      onChange(selected.filter((s) => s !== val))
    } else {
      onChange([...selected, val])
    }
  }

  return (
    <div className="space-y-2">
      {label && <Label className="text-slate-300">{label}</Label>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selected.includes(opt)
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-slate-200'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Field wrapper ─────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-300">
        {label}
        {required && <span className="text-indigo-400 ml-1">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

// ─── Select ───────────────────────────────────────────────────────────────

function FieldSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[] | string[]
  placeholder?: string
}) {
  const opts = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  )
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {opts.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [section, setSection] = useState<Section>(1)
  const [isPending, startTransition] = useTransition()

  // ── Section 1: Company identity ──────────────────────────────────────────
  const [company_name, setCompanyName] = useState('')
  const [country_code, setCountryCode] = useState('')
  const [industry_sector, setIndustrySector] = useState('')
  const [company_size, setCompanySize] = useState('')
  const [website_url, setWebsiteUrl] = useState('')
  const [founding_year, setFoundingYear] = useState('')
  const [one_sentence_pitch, setOneSentencePitch] = useState('')
  const [extended_description, setExtendedDescription] = useState('')
  const [products_services, setProductsServices] = useState<ProductService[]>([{ name: '', description: '' }])
  const [revenue_model, setRevenueModel] = useState('')
  const [geographies_served, setGeographiesServed] = useState<string[]>([])
  const [industries_targeted, setIndustriesTargeted] = useState<string[]>([])
  const [company_sizes_targeted, setCompanySizesTargeted] = useState<string[]>([])
  const [decision_maker_titles, setDecisionMakerTitles] = useState<string[]>([])

  // ── Section 2: Voice & tone ──────────────────────────────────────────────
  const [tone_formal_conversational, setToneFormalConversational] = useState(50)
  const [tone_safe_bold, setToneSafeBold] = useState(50)
  const [tone_corporate_human, setToneCorporateHuman] = useState(50)
  const [tone_data_story, setToneDataStory] = useState(50)
  const [tone_conservative_provocative, setToneConservativeProvocative] = useState(50)
  const [sentence_length, setSentenceLength] = useState('medium')
  const [jargon_level, setJargonLevel] = useState('moderate')
  const [emoji_usage, setEmojiUsage] = useState('sparingly')
  const [cta_style, setCtaStyle] = useState('direct')
  const [voice_examples, setVoiceExamples] = useState(['', '', ''])

  // ── Section 3: Visual identity ───────────────────────────────────────────
  const [brand_colours, setBrandColours] = useState<BrandColours>({
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#06b6d4',
  })
  const [visual_style, setVisualStyle] = useState('')
  const [dark_light_preference, setDarkLightPreference] = useState('')
  const [composition, setComposition] = useState('')
  const [human_faces, setHumanFaces] = useState('')
  const [location_style, setLocationStyle] = useState('')

  // ── Section 4: Content strategy ─────────────────────────────────────────
  const [active_themes, setActiveThemes] = useState<string[]>([])
  const [competitor_names, setCompetitorNames] = useState<string[]>([])
  const [primary_platform, setPrimaryPlatform] = useState('linkedin')
  const [secondary_platform, setSecondaryPlatform] = useState('')
  const [target_posts_per_week, setTargetPostsPerWeek] = useState('3')
  const [timezone, setTimezone] = useState('Europe/London')
  const [topics_to_avoid_s4, setTopicsToAvoidS4] = useState<string[]>([])

  // ── Section 5: Compliance ────────────────────────────────────────────────
  const [phrases_to_avoid, setPhrasesToAvoid] = useState<string[]>([])
  const [visual_styles_to_avoid, setVisualStylesToAvoid] = useState('')
  const [cultural_sensitivities, setCulturalSensitivities] = useState('')

  // ── Helpers ──────────────────────────────────────────────────────────────
  async function getToken() {
    const supabase = getSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  function buildSection1Payload() {
    const validProducts = products_services.filter((p) => p.name.trim())
    return {
      company_name: company_name.trim(),
      country_code,
      industry_sector,
      company_size,
      website_url: website_url.trim() || undefined,
      founding_year: founding_year ? Number(founding_year) : undefined,
      one_sentence_pitch: one_sentence_pitch.trim(),
      extended_description: extended_description.trim() || undefined,
      products_services: validProducts.length > 0 ? validProducts : undefined,
      revenue_model: revenue_model || undefined,
      geographies_served: geographies_served.length > 0 ? geographies_served : undefined,
      industries_targeted: industries_targeted.length > 0 ? industries_targeted : undefined,
      company_sizes_targeted: company_sizes_targeted.length > 0 ? company_sizes_targeted : undefined,
      decision_maker_titles: decision_maker_titles.length > 0 ? decision_maker_titles : undefined,
    }
  }

  function buildSection2Payload() {
    const filteredExamples = voice_examples.filter((e) => e.trim())
    return {
      tone_formal_conversational,
      tone_safe_bold,
      tone_corporate_human,
      tone_data_story,
      tone_conservative_provocative,
      sentence_length,
      jargon_level,
      emoji_usage,
      cta_style,
      voice_examples: filteredExamples.length > 0 ? filteredExamples : undefined,
    }
  }

  function buildSection3Payload() {
    return {
      brand_colours,
      visual_style: visual_style || undefined,
      dark_light_preference: dark_light_preference || undefined,
      composition: composition || undefined,
      human_faces: human_faces || undefined,
      location_style: location_style || undefined,
    }
  }

  function buildSection4Payload() {
    return {
      active_themes: active_themes.length > 0 ? active_themes : undefined,
      competitor_names: competitor_names.length > 0 ? competitor_names : undefined,
      primary_platform,
      secondary_platform: secondary_platform || undefined,
      target_posts_per_week: Number(target_posts_per_week),
      timezone,
      topics_to_avoid: topics_to_avoid_s4.length > 0 ? topics_to_avoid_s4 : undefined,
    }
  }

  function buildSection5Payload() {
    return {
      phrases_to_avoid: phrases_to_avoid.length > 0 ? phrases_to_avoid : undefined,
      visual_styles_to_avoid: visual_styles_to_avoid.trim() || undefined,
      cultural_sensitivities: cultural_sensitivities.trim() || undefined,
    }
  }

  function validateSection1() {
    if (!company_name.trim()) return 'Company name is required'
    if (!country_code) return 'Country is required'
    if (!industry_sector) return 'Industry sector is required'
    if (!company_size) return 'Company size is required'
    if (!one_sentence_pitch.trim()) return 'One-sentence pitch is required'
    return null
  }

  async function handleNext() {
    if (section === 1) {
      const err = validateSection1()
      if (err) { toast.error(err); return }
    }

    startTransition(async () => {
      try {
        let payload: Record<string, unknown>
        if (section === 1) payload = buildSection1Payload()
        else if (section === 2) payload = buildSection2Payload()
        else if (section === 3) payload = buildSection3Payload()
        else payload = buildSection4Payload()

        const token = await getToken()
        await callSaveOnboarding(payload, token)
        setSection((prev) => (prev + 1) as Section)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to save')
      }
    })
  }

  async function handleFinish() {
    startTransition(async () => {
      try {
        const token = await getToken()
        await callSaveOnboarding({ ...buildSection5Payload(), complete: true }, token)
        toast.success('Brand setup complete! Activating your signal sources…')
        router.replace('/dashboard')
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to save')
      }
    })
  }

  function handleBack() {
    setSection((prev) => (prev - 1) as Section)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 flex justify-center">
      <div className="w-full max-w-xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Set up your brand</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Help us personalise your GTM content. You can update this any time in Settings.
          </p>
        </div>

        <ProgressBar current={section} total={5} />

        {/* ── Section 1 ── */}
        {section === 1 && (
          <Section1
            company_name={company_name} setCompanyName={setCompanyName}
            country_code={country_code} setCountryCode={setCountryCode}
            industry_sector={industry_sector} setIndustrySector={setIndustrySector}
            company_size={company_size} setCompanySize={setCompanySize}
            website_url={website_url} setWebsiteUrl={setWebsiteUrl}
            founding_year={founding_year} setFoundingYear={setFoundingYear}
            one_sentence_pitch={one_sentence_pitch} setOneSentencePitch={setOneSentencePitch}
            extended_description={extended_description} setExtendedDescription={setExtendedDescription}
            products_services={products_services} setProductsServices={setProductsServices}
            revenue_model={revenue_model} setRevenueModel={setRevenueModel}
            geographies_served={geographies_served} setGeographiesServed={setGeographiesServed}
            industries_targeted={industries_targeted} setIndustriesTargeted={setIndustriesTargeted}
            company_sizes_targeted={company_sizes_targeted} setCompanySizesTargeted={setCompanySizesTargeted}
            decision_maker_titles={decision_maker_titles} setDecisionMakerTitles={setDecisionMakerTitles}
          />
        )}

        {/* ── Section 2 ── */}
        {section === 2 && (
          <Section2
            tone_formal_conversational={tone_formal_conversational} setToneFormalConversational={setToneFormalConversational}
            tone_safe_bold={tone_safe_bold} setToneSafeBold={setToneSafeBold}
            tone_corporate_human={tone_corporate_human} setToneCorporateHuman={setToneCorporateHuman}
            tone_data_story={tone_data_story} setToneDataStory={setToneDataStory}
            tone_conservative_provocative={tone_conservative_provocative} setToneConservativeProvocative={setToneConservativeProvocative}
            sentence_length={sentence_length} setSentenceLength={setSentenceLength}
            jargon_level={jargon_level} setJargonLevel={setJargonLevel}
            emoji_usage={emoji_usage} setEmojiUsage={setEmojiUsage}
            cta_style={cta_style} setCtaStyle={setCtaStyle}
            voice_examples={voice_examples} setVoiceExamples={setVoiceExamples}
          />
        )}

        {/* ── Section 3 ── */}
        {section === 3 && (
          <Section3
            brand_colours={brand_colours} setBrandColours={setBrandColours}
            visual_style={visual_style} setVisualStyle={setVisualStyle}
            dark_light_preference={dark_light_preference} setDarkLightPreference={setDarkLightPreference}
            composition={composition} setComposition={setComposition}
            human_faces={human_faces} setHumanFaces={setHumanFaces}
            location_style={location_style} setLocationStyle={setLocationStyle}
          />
        )}

        {/* ── Section 4 ── */}
        {section === 4 && (
          <Section4
            active_themes={active_themes} setActiveThemes={setActiveThemes}
            competitor_names={competitor_names} setCompetitorNames={setCompetitorNames}
            primary_platform={primary_platform} setPrimaryPlatform={setPrimaryPlatform}
            secondary_platform={secondary_platform} setSecondaryPlatform={setSecondaryPlatform}
            target_posts_per_week={target_posts_per_week} setTargetPostsPerWeek={setTargetPostsPerWeek}
            timezone={timezone} setTimezone={setTimezone}
            topics_to_avoid={topics_to_avoid_s4} setTopicsToAvoid={setTopicsToAvoidS4}
          />
        )}

        {/* ── Section 5 ── */}
        {section === 5 && (
          <Section5
            phrases_to_avoid={phrases_to_avoid} setPhrasesToAvoid={setPhrasesToAvoid}
            visual_styles_to_avoid={visual_styles_to_avoid} setVisualStylesToAvoid={setVisualStylesToAvoid}
            cultural_sensitivities={cultural_sensitivities} setCulturalSensitivities={setCulturalSensitivities}
          />
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 pb-12">
          {section > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={isPending}
              className="text-slate-400 hover:text-slate-200"
            >
              ← Back
            </Button>
          ) : (
            <div />
          )}

          {section < 5 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[120px]"
            >
              {isPending ? 'Saving…' : 'Next →'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFinish}
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[160px]"
            >
              {isPending ? 'Finishing…' : 'Finish setup →'}
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}

// ─── Section 1 ─────────────────────────────────────────────────────────────

function Section1({
  company_name, setCompanyName,
  country_code, setCountryCode,
  industry_sector, setIndustrySector,
  company_size, setCompanySize,
  website_url, setWebsiteUrl,
  founding_year, setFoundingYear,
  one_sentence_pitch, setOneSentencePitch,
  extended_description, setExtendedDescription,
  products_services, setProductsServices,
  revenue_model, setRevenueModel,
  geographies_served, setGeographiesServed,
  industries_targeted, setIndustriesTargeted,
  company_sizes_targeted, setCompanySizesTargeted,
  decision_maker_titles, setDecisionMakerTitles,
}: {
  company_name: string; setCompanyName: (v: string) => void
  country_code: string; setCountryCode: (v: string) => void
  industry_sector: string; setIndustrySector: (v: string) => void
  company_size: string; setCompanySize: (v: string) => void
  website_url: string; setWebsiteUrl: (v: string) => void
  founding_year: string; setFoundingYear: (v: string) => void
  one_sentence_pitch: string; setOneSentencePitch: (v: string) => void
  extended_description: string; setExtendedDescription: (v: string) => void
  products_services: ProductService[]; setProductsServices: (v: ProductService[]) => void
  revenue_model: string; setRevenueModel: (v: string) => void
  geographies_served: string[]; setGeographiesServed: (v: string[]) => void
  industries_targeted: string[]; setIndustriesTargeted: (v: string[]) => void
  company_sizes_targeted: string[]; setCompanySizesTargeted: (v: string[]) => void
  decision_maker_titles: string[]; setDecisionMakerTitles: (v: string[]) => void
}) {
  function updateProduct(index: number, field: keyof ProductService, value: string) {
    const updated = [...products_services]
    updated[index] = { ...updated[index], [field]: value }
    setProductsServices(updated)
  }

  function addProduct() {
    if (products_services.length < 5) {
      setProductsServices([...products_services, { name: '', description: '' }])
    }
  }

  function removeProduct(index: number) {
    setProductsServices(products_services.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Company identity</h2>
        <p className="text-slate-400 text-sm mt-0.5">Tell us who you are and who you sell to.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Company name" required>
          <Input
            value={company_name}
            onChange={(e) => setCompanyName(e.target.value)}
            maxLength={200}
            placeholder="Acme Inc."
            className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
          />
        </Field>

        <Field label="Country / region" required>
          <FieldSelect
            value={country_code}
            onChange={setCountryCode}
            options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
            placeholder="Select country…"
          />
        </Field>

        <Field label="Industry sector" required>
          <FieldSelect
            value={industry_sector}
            onChange={setIndustrySector}
            options={INDUSTRIES}
            placeholder="Select industry…"
          />
        </Field>

        <Field label="Company size" required>
          <FieldSelect
            value={company_size}
            onChange={setCompanySize}
            options={COMPANY_SIZES}
            placeholder="Select size…"
          />
        </Field>

        <Field label="Website URL">
          <Input
            value={website_url}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            type="url"
            placeholder="https://acme.com"
            className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
          />
        </Field>

        <Field label="Founding year">
          <Input
            value={founding_year}
            onChange={(e) => setFoundingYear(e.target.value)}
            type="number"
            min={1800}
            max={2100}
            placeholder="2020"
            className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
          />
        </Field>
      </div>

      <Field label="One-sentence pitch" required hint={`${one_sentence_pitch.length}/200 chars — What problem do you solve, for whom?`}>
        <Textarea
          value={one_sentence_pitch}
          onChange={(e) => setOneSentencePitch(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="We help B2B SaaS teams automate their go-to-market motion with AI."
          className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none"
        />
      </Field>

      <Field label="Extended description" hint="3–5 sentences about your company">
        <Textarea
          value={extended_description}
          onChange={(e) => setExtendedDescription(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Describe what you do, your unique value, and your market position…"
          className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none"
        />
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-slate-300">Products / services</Label>
          <span className="text-xs text-slate-500">Up to 5</span>
        </div>
        {products_services.map((ps, i) => (
          <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start">
            <Input
              value={ps.name}
              onChange={(e) => updateProduct(i, 'name', e.target.value)}
              placeholder="Product name"
              maxLength={100}
              className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
            />
            <Input
              value={ps.description}
              onChange={(e) => updateProduct(i, 'description', e.target.value)}
              placeholder="Short description"
              maxLength={500}
              className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
            />
            {products_services.length > 1 && (
              <button
                type="button"
                onClick={() => removeProduct(i)}
                className="text-slate-500 hover:text-red-400 text-lg leading-none mt-2"
                aria-label="Remove"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {products_services.length < 5 && (
          <button
            type="button"
            onClick={addProduct}
            className="text-indigo-400 text-sm hover:underline"
          >
            + Add another product
          </button>
        )}
      </div>

      <Field label="Revenue model">
        <FieldSelect value={revenue_model} onChange={setRevenueModel} options={REVENUE_MODELS} placeholder="Select model…" />
      </Field>

      <div className="pt-2 border-t border-slate-800 space-y-5">
        <p className="text-sm text-slate-400 font-medium">Who do you sell to?</p>

        <MultiSelect
          label="Target geographies"
          options={COUNTRIES.map((c) => c.name)}
          selected={geographies_served}
          onChange={setGeographiesServed}
        />

        <MultiSelect
          label="Target industries"
          options={INDUSTRIES}
          selected={industries_targeted}
          onChange={setIndustriesTargeted}
        />

        <MultiSelect
          label="Target company sizes"
          options={ICP_COMPANY_SIZES}
          selected={company_sizes_targeted}
          onChange={setCompanySizesTargeted}
        />

        <TagInput
          label="Primary decision-maker titles"
          tags={decision_maker_titles}
          onChange={setDecisionMakerTitles}
          placeholder="e.g. VP Marketing"
          max={5}
        />
      </div>
    </div>
  )
}

// ─── Section 2 ─────────────────────────────────────────────────────────────

function Section2({
  tone_formal_conversational, setToneFormalConversational,
  tone_safe_bold, setToneSafeBold,
  tone_corporate_human, setToneCorporateHuman,
  tone_data_story, setToneDataStory,
  tone_conservative_provocative, setToneConservativeProvocative,
  sentence_length, setSentenceLength,
  jargon_level, setJargonLevel,
  emoji_usage, setEmojiUsage,
  cta_style, setCtaStyle,
  voice_examples, setVoiceExamples,
}: {
  tone_formal_conversational: number; setToneFormalConversational: (v: number) => void
  tone_safe_bold: number; setToneSafeBold: (v: number) => void
  tone_corporate_human: number; setToneCorporateHuman: (v: number) => void
  tone_data_story: number; setToneDataStory: (v: number) => void
  tone_conservative_provocative: number; setToneConservativeProvocative: (v: number) => void
  sentence_length: string; setSentenceLength: (v: string) => void
  jargon_level: string; setJargonLevel: (v: string) => void
  emoji_usage: string; setEmojiUsage: (v: string) => void
  cta_style: string; setCtaStyle: (v: string) => void
  voice_examples: string[]; setVoiceExamples: (v: string[]) => void
}) {
  function updateExample(index: number, value: string) {
    const updated = [...voice_examples]
    updated[index] = value
    setVoiceExamples(updated)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Voice &amp; tone</h2>
        <p className="text-slate-400 text-sm mt-0.5">Calibrate how your brand communicates.</p>
      </div>

      <div className="space-y-5 bg-slate-900/40 rounded-xl p-5 border border-slate-800">
        <p className="text-sm font-medium text-slate-300">Tone sliders</p>
        <ToneSlider
          label="Communication style"
          leftLabel="Conversational"
          rightLabel="Formal"
          value={tone_formal_conversational}
          onChange={setToneFormalConversational}
        />
        <ToneSlider
          label="Risk appetite"
          leftLabel="Safe &amp; conservative"
          rightLabel="Bold &amp; daring"
          value={tone_safe_bold}
          onChange={setToneSafeBold}
        />
        <ToneSlider
          label="Brand personality"
          leftLabel="Human &amp; warm"
          rightLabel="Corporate &amp; polished"
          value={tone_corporate_human}
          onChange={setToneCorporateHuman}
        />
        <ToneSlider
          label="Content style"
          leftLabel="Story-led"
          rightLabel="Data-driven"
          value={tone_data_story}
          onChange={setToneDataStory}
        />
        <ToneSlider
          label="Provocation level"
          leftLabel="Conservative"
          rightLabel="Provocative"
          value={tone_conservative_provocative}
          onChange={setToneConservativeProvocative}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Sentence length">
          <FieldSelect
            value={sentence_length}
            onChange={setSentenceLength}
            options={[
              { value: 'short', label: 'Short — punchy, <15 words' },
              { value: 'medium', label: 'Medium — 15–25 words' },
              { value: 'long', label: 'Long — detailed, 25+ words' },
            ]}
          />
        </Field>

        <Field label="Industry jargon">
          <FieldSelect
            value={jargon_level}
            onChange={setJargonLevel}
            options={[
              { value: 'avoid', label: 'Avoid — plain English only' },
              { value: 'moderate', label: 'Moderate — some terminology OK' },
              { value: 'heavy', label: 'Heavy — expert audience' },
            ]}
          />
        </Field>

        <Field label="Emoji usage">
          <FieldSelect
            value={emoji_usage}
            onChange={setEmojiUsage}
            options={[
              { value: 'never', label: 'Never' },
              { value: 'sparingly', label: 'Sparingly — 1-2 per post' },
              { value: 'freely', label: 'Freely — wherever natural' },
            ]}
          />
        </Field>

        <Field label="Call-to-action style">
          <FieldSelect
            value={cta_style}
            onChange={setCtaStyle}
            options={[
              { value: 'soft', label: 'Soft — invite to learn more' },
              { value: 'direct', label: 'Direct — clear action' },
              { value: 'urgent', label: 'Urgent — time-sensitive push' },
            ]}
          />
        </Field>
      </div>

      <div className="space-y-3">
        <Label className="text-slate-300">
          Voice examples
          <span className="text-slate-500 font-normal ml-2 text-xs">Optional — up to 3 samples of your existing content</span>
        </Label>
        {voice_examples.map((ex, i) => (
          <Textarea
            key={i}
            value={ex}
            onChange={(e) => updateExample(i, e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={`Example ${i + 1} — paste a LinkedIn post, email, or tweet that sounds like your brand…`}
            className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none"
          />
        ))}
      </div>
    </div>
  )
}

// ─── Section 3 ─────────────────────────────────────────────────────────────

function Section3({
  brand_colours, setBrandColours,
  visual_style, setVisualStyle,
  dark_light_preference, setDarkLightPreference,
  composition, setComposition,
  human_faces, setHumanFaces,
  location_style, setLocationStyle,
}: {
  brand_colours: BrandColours; setBrandColours: (v: BrandColours) => void
  visual_style: string; setVisualStyle: (v: string) => void
  dark_light_preference: string; setDarkLightPreference: (v: string) => void
  composition: string; setComposition: (v: string) => void
  human_faces: string; setHumanFaces: (v: string) => void
  location_style: string; setLocationStyle: (v: string) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Visual identity</h2>
        <p className="text-slate-400 text-sm mt-0.5">Configure how your brand looks visually.</p>
      </div>

      <div className="space-y-3">
        <Label className="text-slate-300">Brand colours</Label>
        <div className="grid grid-cols-3 gap-3">
          {(['primary', 'secondary', 'accent'] as const).map((key) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs text-slate-400 capitalize">{key}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brand_colours[key]}
                  onChange={(e) => setBrandColours({ ...brand_colours, [key]: e.target.value })}
                  className="h-8 w-10 rounded cursor-pointer bg-slate-800 border border-slate-700"
                />
                <Input
                  value={brand_colours[key]}
                  onChange={(e) => setBrandColours({ ...brand_colours, [key]: e.target.value })}
                  maxLength={20}
                  placeholder="#6366f1"
                  className="bg-slate-800 border-slate-700 text-slate-100 text-xs placeholder:text-slate-500 font-mono"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Visual style">
          <FieldSelect
            value={visual_style}
            onChange={setVisualStyle}
            options={[
              { value: 'photography', label: 'Photography' },
              { value: 'illustration', label: 'Illustration' },
              { value: 'abstract', label: 'Abstract' },
              { value: '3d', label: '3D render' },
              { value: 'flat', label: 'Flat design' },
            ]}
            placeholder="Select style…"
          />
        </Field>

        <Field label="Dark / light preference">
          <FieldSelect
            value={dark_light_preference}
            onChange={setDarkLightPreference}
            options={[
              { value: 'dark', label: 'Dark backgrounds' },
              { value: 'light', label: 'Light backgrounds' },
              { value: 'neutral', label: 'No preference' },
            ]}
            placeholder="Select preference…"
          />
        </Field>

        <Field label="Composition style">
          <FieldSelect
            value={composition}
            onChange={setComposition}
            options={[
              { value: 'busy', label: 'Busy — lots of detail' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'minimal', label: 'Minimal — clean space' },
            ]}
            placeholder="Select composition…"
          />
        </Field>

        <Field label="Human faces in imagery">
          <FieldSelect
            value={human_faces}
            onChange={setHumanFaces}
            options={[
              { value: 'yes', label: 'Yes — include people' },
              { value: 'no', label: 'No — no people please' },
              { value: 'diverse_only', label: 'Yes — diverse representation' },
            ]}
            placeholder="Select preference…"
          />
        </Field>

        <Field label="Location / setting style">
          <FieldSelect
            value={location_style}
            onChange={setLocationStyle}
            options={[
              { value: 'real_locations', label: 'Real locations' },
              { value: 'studio', label: 'Studio / neutral' },
              { value: 'abstract', label: 'Abstract / conceptual' },
            ]}
            placeholder="Select setting…"
          />
        </Field>
      </div>
    </div>
  )
}

// ─── Section 4 ─────────────────────────────────────────────────────────────

function Section4({
  active_themes, setActiveThemes,
  competitor_names, setCompetitorNames,
  primary_platform, setPrimaryPlatform,
  secondary_platform, setSecondaryPlatform,
  target_posts_per_week, setTargetPostsPerWeek,
  timezone, setTimezone,
  topics_to_avoid, setTopicsToAvoid,
}: {
  active_themes: string[]; setActiveThemes: (v: string[]) => void
  competitor_names: string[]; setCompetitorNames: (v: string[]) => void
  primary_platform: string; setPrimaryPlatform: (v: string) => void
  secondary_platform: string; setSecondaryPlatform: (v: string) => void
  target_posts_per_week: string; setTargetPostsPerWeek: (v: string) => void
  timezone: string; setTimezone: (v: string) => void
  topics_to_avoid: string[]; setTopicsToAvoid: (v: string[]) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Content strategy</h2>
        <p className="text-slate-400 text-sm mt-0.5">What themes matter to you, and where do you publish?</p>
      </div>

      <TagInput
        label="Active campaign themes"
        tags={active_themes}
        onChange={setActiveThemes}
        placeholder="e.g. AI in B2B Sales"
        max={3}
      />
      <p className="text-xs text-slate-500 -mt-3">
        Signals are scored against these themes. Up to 3. Be specific — e.g. &apos;AI in financial services&apos; not just &apos;AI&apos;.
      </p>

      <TagInput
        label="Competitor names"
        tags={competitor_names}
        onChange={setCompetitorNames}
        placeholder="e.g. Salesforce, HubSpot"
        max={10}
      />
      <p className="text-xs text-slate-500 -mt-3">
        We will track news about these companies so you can respond in your GTM content.
      </p>

      <TagInput
        label="Topics to avoid"
        tags={topics_to_avoid}
        onChange={setTopicsToAvoid}
        placeholder="e.g. politics, religion"
        max={20}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Primary platform">
          <FieldSelect
            value={primary_platform}
            onChange={setPrimaryPlatform}
            options={PLATFORMS.map((p) => ({ value: p.value, label: p.label }))}
          />
        </Field>

        <Field label="Secondary platform">
          <FieldSelect
            value={secondary_platform}
            onChange={setSecondaryPlatform}
            options={PLATFORMS.map((p) => ({ value: p.value, label: p.label }))}
            placeholder="None"
          />
        </Field>

        <Field label="Target posts per week">
          <Input
            value={target_posts_per_week}
            onChange={(e) => setTargetPostsPerWeek(e.target.value)}
            type="number"
            min={0}
            max={100}
            className="bg-slate-800 border-slate-700 text-slate-100"
          />
        </Field>

        <Field label="Your timezone">
          <FieldSelect
            value={timezone}
            onChange={setTimezone}
            options={TIMEZONES}
          />
        </Field>
      </div>
    </div>
  )
}

// ─── Section 5 ─────────────────────────────────────────────────────────────

function Section5({
  phrases_to_avoid, setPhrasesToAvoid,
  visual_styles_to_avoid, setVisualStylesToAvoid,
  cultural_sensitivities, setCulturalSensitivities,
}: {
  phrases_to_avoid: string[]; setPhrasesToAvoid: (v: string[]) => void
  visual_styles_to_avoid: string; setVisualStylesToAvoid: (v: string) => void
  cultural_sensitivities: string; setCulturalSensitivities: (v: string) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Compliance &amp; guardrails</h2>
        <p className="text-slate-400 text-sm mt-0.5">
          Tell the AI what to avoid. These act as negative prompts across all generation.
        </p>
      </div>

      <TagInput
        label="Phrases to avoid"
        tags={phrases_to_avoid}
        onChange={setPhrasesToAvoid}
        placeholder="e.g. 'disruptive', 'synergy', 'leverage'"
        max={20}
      />

      <Field label="Visual styles to avoid" hint="Describe imagery styles you don't want">
        <Textarea
          value={visual_styles_to_avoid}
          onChange={(e) => setVisualStylesToAvoid(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g. Avoid cheesy stock photos, avoid neon colours, avoid busy compositions…"
          className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none"
        />
      </Field>

      <Field label="Cultural sensitivities" hint="Any cultural, religious, or regional sensitivities your content must respect">
        <Textarea
          value={cultural_sensitivities}
          onChange={(e) => setCulturalSensitivities(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g. Avoid religious imagery, sensitive to Middle East market norms, no alcohol references…"
          className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none"
        />
      </Field>

      <div className="rounded-lg bg-indigo-950/40 border border-indigo-800/50 p-4 text-sm text-indigo-300">
        <p className="font-medium mb-1">You&apos;re almost done</p>
        <p className="text-indigo-400 text-xs">
          After finishing setup, we&apos;ll activate signal sources for your region and start surfacing relevant trends within 15 minutes.
          You can update any of these settings at any time from the Settings page.
        </p>
      </div>
    </div>
  )
}
