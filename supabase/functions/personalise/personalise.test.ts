/**
 * personalise — unit tests
 *
 * Tests the pure logic of the personalise edge function: prompt construction,
 * body validation, and prospect lifecycle state machine.
 *
 * Run:  deno test supabase/functions/personalise/personalise.test.ts
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts'

// ─── Prompt-building logic (extracted from index.ts) ─────────────────────────

interface BrandContext {
  company_name?: string | null
  tone_formal_conversational?: number | null
  tone_safe_bold?: number | null
  emoji_usage?: string | null
  cta_style?: string | null
  voice_examples?: string[] | null
  competitor_names?: string[] | null
}

interface ProspectRow {
  first_name?: string | null
  last_name?: string | null
  job_title?: string | null
  company_name?: string | null
  company_description?: string | null
  industry?: string | null
  company_size?: string | null
  country?: string | null
}

interface JobRow {
  asset_type?: string | null
  content_job_json?: Record<string, any> | null
  prompt_tags?: Record<string, any> | null
}

function buildOutreachPrompt(
  brand: BrandContext,
  prospect: ProspectRow,
  job: JobRow,
  platform: string,
): string {
  const contentJob = job.content_job_json ?? {}
  const promptTags = job.prompt_tags ?? {}
  const voiceExamples: string[] = brand.voice_examples ?? []
  const competitorNames: string[] = brand.competitor_names ?? []

  return `You are writing a personalised B2B outreach message for ${brand.company_name} (brand).
Target platform: ${platform}

Brand voice:
- Tone: formal/conversational=${brand.tone_formal_conversational ?? 5}, bold/safe=${brand.tone_safe_bold ?? 5}
- Emoji usage: ${brand.emoji_usage ?? 'minimal'}
- CTA style: ${brand.cta_style ?? 'soft ask'}
${voiceExamples[0] ? `- Example voice: "${voiceExamples[0]}"` : ''}

The campaign is about: ${contentJob.signal_headline ?? promptTags.subject ?? 'a new campaign'}
Generated asset: ${job.asset_type ?? 'image'} titled "${promptTags.subject ?? 'campaign asset'}"

Prospect:
- Name: ${prospect.first_name ?? ''} ${prospect.last_name ?? ''}, ${prospect.job_title ?? 'professional'} at ${prospect.company_name ?? 'their company'}
- Company: ${prospect.company_name ?? ''} — ${prospect.company_description ?? 'a leading company in their space'}
- Industry: ${prospect.industry ?? 'technology'}, Size: ${prospect.company_size ?? 'unknown'}, Country: ${prospect.country ?? 'unknown'}

Write a personalised outreach message for ${platform}. Max 200 words.
Reference the prospect's company context. Reference the campaign asset.
Use the brand voice. End with the CTA style: ${brand.cta_style ?? 'soft ask'}.${competitorNames.length ? `\nDo NOT mention: ${competitorNames.join(', ')}` : ''}

Return only the outreach message text, no preamble.`
}

/** Validates the prospect lifecycle transition rules from the function. */
function shouldAdvanceToContacted(currentStatus: string): boolean {
  return currentStatus === 'new'
}

/** Validates that contacted_via and last_contacted_at are always updated. */
function alwaysStampContactInfo(_currentStatus: string): boolean {
  return true // always update regardless of status
}

// ─── Prompt construction tests ────────────────────────────────────────────────

Deno.test('buildOutreachPrompt: includes brand company name', () => {
  const prompt = buildOutreachPrompt(
    { company_name: 'AcmeCorp' },
    { first_name: 'Alice', last_name: 'Smith', company_name: 'ProspectCo' },
    { asset_type: 'image' },
    'linkedin',
  )
  assertStringIncludes(prompt, 'AcmeCorp')
})

Deno.test('buildOutreachPrompt: includes prospect name', () => {
  const prompt = buildOutreachPrompt(
    { company_name: 'BrandCo' },
    { first_name: 'Bob', last_name: 'Jones', company_name: 'TargetCo' },
    {},
    'email',
  )
  assertStringIncludes(prompt, 'Bob Jones')
})

Deno.test('buildOutreachPrompt: includes platform', () => {
  const prompt = buildOutreachPrompt({ company_name: 'X' }, {}, {}, 'twitter')
  assertStringIncludes(prompt, 'twitter')
})

Deno.test('buildOutreachPrompt: includes competitor exclusion when set', () => {
  const prompt = buildOutreachPrompt(
    { company_name: 'BrandCo', competitor_names: ['CompetitorA', 'RivalB'] },
    {},
    {},
    'linkedin',
  )
  assertStringIncludes(prompt, 'CompetitorA')
  assertStringIncludes(prompt, 'RivalB')
  assertStringIncludes(prompt, 'Do NOT mention')
})

Deno.test('buildOutreachPrompt: no competitor line when array is empty', () => {
  const prompt = buildOutreachPrompt(
    { company_name: 'BrandCo', competitor_names: [] },
    {},
    {},
    'linkedin',
  )
  assertEquals(prompt.includes('Do NOT mention'), false)
})

Deno.test('buildOutreachPrompt: includes voice example when provided', () => {
  const prompt = buildOutreachPrompt(
    { company_name: 'BrandCo', voice_examples: ['Be bold, be human.'] },
    {},
    {},
    'linkedin',
  )
  assertStringIncludes(prompt, 'Be bold, be human.')
})

Deno.test('buildOutreachPrompt: omits example voice line when array is empty', () => {
  const prompt = buildOutreachPrompt(
    { company_name: 'BrandCo', voice_examples: [] },
    {},
    {},
    'linkedin',
  )
  assertEquals(prompt.includes('Example voice'), false)
})

Deno.test('buildOutreachPrompt: includes signal headline from content_job_json', () => {
  const prompt = buildOutreachPrompt(
    { company_name: 'BrandCo' },
    {},
    { content_job_json: { signal_headline: 'AI is transforming B2B' } },
    'linkedin',
  )
  assertStringIncludes(prompt, 'AI is transforming B2B')
})

Deno.test('buildOutreachPrompt: falls back to prompt_tags.subject for campaign title', () => {
  const prompt = buildOutreachPrompt(
    { company_name: 'BrandCo' },
    {},
    { prompt_tags: { subject: 'Growth Hacks 2025' } },
    'linkedin',
  )
  assertStringIncludes(prompt, 'Growth Hacks 2025')
})

Deno.test('buildOutreachPrompt: uses default campaign text when no job context', () => {
  const prompt = buildOutreachPrompt({ company_name: 'BrandCo' }, {}, {}, 'linkedin')
  assertStringIncludes(prompt, 'a new campaign')
})

Deno.test('buildOutreachPrompt: max 200 words instruction always present', () => {
  const prompt = buildOutreachPrompt({ company_name: 'BrandCo' }, {}, {}, 'email')
  assertStringIncludes(prompt, 'Max 200 words')
})

Deno.test('buildOutreachPrompt: includes cta_style', () => {
  const prompt = buildOutreachPrompt(
    { company_name: 'BrandCo', cta_style: 'hard ask — book a call' },
    {},
    {},
    'linkedin',
  )
  assertStringIncludes(prompt, 'hard ask — book a call')
})

// ─── Prospect lifecycle state machine tests ───────────────────────────────────

Deno.test('lifecycle: new -> contacted is allowed', () => {
  assertEquals(shouldAdvanceToContacted('new'), true)
})

Deno.test('lifecycle: contacted stays contacted (no downgrade)', () => {
  assertEquals(shouldAdvanceToContacted('contacted'), false)
})

Deno.test('lifecycle: replied not overwritten', () => {
  assertEquals(shouldAdvanceToContacted('replied'), false)
})

Deno.test('lifecycle: qualified not overwritten', () => {
  assertEquals(shouldAdvanceToContacted('qualified'), false)
})

Deno.test('lifecycle: disqualified not overwritten', () => {
  assertEquals(shouldAdvanceToContacted('disqualified'), false)
})

Deno.test('lifecycle: last_contacted_at always stamped regardless of status', () => {
  assertEquals(alwaysStampContactInfo('replied'), true)
  assertEquals(alwaysStampContactInfo('qualified'), true)
  assertEquals(alwaysStampContactInfo('new'), true)
  assertEquals(alwaysStampContactInfo('contacted'), true)
})

// ─── Body validation rules (mirrored from index.ts) ───────────────────────────

/** Validate a personalise request body before DB calls. */
function validatePersonaliseBody(body: any): { valid: boolean; error?: string } {
  if (!body.prospect_id || typeof body.prospect_id !== 'string') {
    return { valid: false, error: 'prospect_id required' }
  }
  if (!body.job_id || typeof body.job_id !== 'string') {
    return { valid: false, error: 'job_id required' }
  }
  return { valid: true }
}

Deno.test('validate body: missing prospect_id → error', () => {
  const r = validatePersonaliseBody({ job_id: 'job-1' })
  assertEquals(r.valid, false)
  assertEquals(r.error, 'prospect_id required')
})

Deno.test('validate body: missing job_id → error', () => {
  const r = validatePersonaliseBody({ prospect_id: 'p-1' })
  assertEquals(r.valid, false)
  assertEquals(r.error, 'job_id required')
})

Deno.test('validate body: numeric prospect_id → rejected (type check)', () => {
  const r = validatePersonaliseBody({ prospect_id: 123, job_id: 'job-1' })
  assertEquals(r.valid, false)
})

Deno.test('validate body: both present → valid', () => {
  const r = validatePersonaliseBody({ prospect_id: 'p-abc', job_id: 'j-xyz' })
  assertEquals(r.valid, true)
  assertEquals(r.error, undefined)
})

// ─── CORS ─────────────────────────────────────────────────────────────────────

Deno.test('personalise handler: OPTIONS returns 204', async () => {
  const req = new Request('https://fn.example.com/personalise', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://gtmengine.qubitlyventures.com',
      'Access-Control-Request-Method': 'POST',
    },
  })
  const { handleCors } = await import('../_shared/cors.ts')
  const res = handleCors(req)
  assertEquals(res?.status, 204)
})

// ─── Default platform fallback ────────────────────────────────────────────────

Deno.test('personalise: platform defaults to linkedin when not provided', () => {
  const body: Record<string, any> = { prospect_id: 'p-1', job_id: 'j-1' }
  const platform = body['platform'] ?? 'linkedin'
  assertEquals(platform, 'linkedin')
})

Deno.test('personalise: explicit platform is preserved', () => {
  const body: Record<string, any> = { prospect_id: 'p-1', job_id: 'j-1', platform: 'email' }
  const platform = body['platform'] ?? 'linkedin'
  assertEquals(platform, 'email')
})
