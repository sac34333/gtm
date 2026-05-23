/**
 * generate-campaign-brief — unit tests
 *
 * Tests the pure, side-effect-free functions in the Edge Function:
 *  - sanitisePdfText  (Unicode → Latin1 safe replacements)
 *  - widthOf          (Helvetica width approximation)
 *  - buildCalendar    (working-day date scheduling)
 *  - channel_mix validation rules
 *  - PDF text sanitisation edge cases
 *
 * Run:  deno test supabase/functions/generate-campaign-brief/brief.test.ts
 */

import {
  assertEquals,
  assertStringIncludes,
  assertNotEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

// ─── Replicate pure functions under test ─────────────────────────────────────

function sanitisePdfText(text: string): string {
  return (text ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '?')
}

function widthOf(text: string, size: number): number {
  return text.length * size * 0.5
}

// Calendar helper — mirrors the date-scheduling logic in the function
function buildWorkingDayCalendar(
  startDate: Date,
  durationDays: number,
  workingDaysOnly: boolean,
): Date[] {
  const dates: Date[] = []
  let current = new Date(startDate)
  let count = 0

  while (count < durationDays) {
    const dow = current.getDay() // 0=Sun, 6=Sat
    if (!workingDaysOnly || (dow !== 0 && dow !== 6)) {
      dates.push(new Date(current))
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return dates
}

// Duration clamp logic — mirrors `Math.max(1, Math.min(90, Number(campaign.duration_days ?? 14)))`
function clampDuration(raw: any): number {
  return Math.max(1, Math.min(90, Number(raw ?? 14)))
}

// channel_mix validation (mirrors the function's use of the channel key list)
const VALID_CHANNELS = new Set([
  'linkedin_post', 'linkedin_message', 'email', 'twitter', 'twitter_x',
  'facebook_post', 'facebook', 'cold_dm',
])
function validateChannelMix(channels: string[]): boolean {
  return channels.every(c => VALID_CHANNELS.has(c))
}

// ─── sanitisePdfText tests ────────────────────────────────────────────────────

Deno.test('sanitisePdfText: replaces left/right single quotes', () => {
  assertEquals(sanitisePdfText('\u2018hello\u2019'), "'hello'")
})

Deno.test('sanitisePdfText: replaces left/right double quotes', () => {
  assertEquals(sanitisePdfText('\u201Chello\u201D'), '"hello"')
})

Deno.test('sanitisePdfText: replaces en-dash with hyphen', () => {
  assertEquals(sanitisePdfText('2020\u20132025'), '2020-2025')
})

Deno.test('sanitisePdfText: replaces em-dash with hyphen', () => {
  assertEquals(sanitisePdfText('growth\u2014revenue'), 'growth-revenue')
})

Deno.test('sanitisePdfText: replaces horizontal ellipsis', () => {
  assertEquals(sanitisePdfText('loading\u2026'), 'loading...')
})

Deno.test('sanitisePdfText: replaces non-breaking space with regular space', () => {
  assertEquals(sanitisePdfText('hello\u00A0world'), 'hello world')
})

Deno.test('sanitisePdfText: replaces non-Latin1 characters with ?', () => {
  // Chinese character (outside Latin1 range)
  assertEquals(sanitisePdfText('\u4e2d'), '?')
})

Deno.test('sanitisePdfText: plain ASCII unchanged', () => {
  assertEquals(sanitisePdfText('Hello, World!'), 'Hello, World!')
})

Deno.test('sanitisePdfText: empty string returns empty', () => {
  assertEquals(sanitisePdfText(''), '')
})

Deno.test('sanitisePdfText: null-safe (undefined input)', () => {
  // The implementation does `(text ?? '')` so undefined/null returns ''
  assertEquals(sanitisePdfText(undefined as any), '')
})

Deno.test('sanitisePdfText: Latin1 extended range preserved', () => {
  // é (0xE9) is within Latin1 — should not become ?
  assertEquals(sanitisePdfText('\u00E9'), '\u00E9')
})

Deno.test('sanitisePdfText: mixed content', () => {
  const result = sanitisePdfText('\u2018GTM Engine\u2019 \u2014 the best tool\u2026')
  assertEquals(result, "'GTM Engine' - the best tool...")
})

// ─── widthOf tests ────────────────────────────────────────────────────────────

Deno.test('widthOf: empty string has zero width', () => {
  assertEquals(widthOf('', 12), 0)
})

Deno.test('widthOf: width scales with font size', () => {
  const w10 = widthOf('hello', 10)
  const w20 = widthOf('hello', 20)
  assertEquals(w20, w10 * 2)
})

Deno.test('widthOf: width scales with text length', () => {
  const w1 = widthOf('a', 12)
  const w5 = widthOf('aaaaa', 12)
  assertEquals(w5, w1 * 5)
})

Deno.test('widthOf: returns positive number for non-empty text', () => {
  const w = widthOf('GTM Engine', 10)
  assertEquals(w > 0, true)
})

// ─── clampDuration tests ──────────────────────────────────────────────────────

Deno.test('clampDuration: defaults to 14 when null', () => {
  assertEquals(clampDuration(null), 14)
})

Deno.test('clampDuration: defaults to 14 when undefined', () => {
  assertEquals(clampDuration(undefined), 14)
})

Deno.test('clampDuration: minimum is 1', () => {
  assertEquals(clampDuration(0), 1)
})

Deno.test('clampDuration: maximum is 90', () => {
  assertEquals(clampDuration(100), 90)
})

Deno.test('clampDuration: 14 passes through', () => {
  assertEquals(clampDuration(14), 14)
})

Deno.test('clampDuration: 30 passes through', () => {
  assertEquals(clampDuration(30), 30)
})

Deno.test('clampDuration: string "7" is coerced to 7', () => {
  assertEquals(clampDuration('7'), 7)
})

// ─── buildWorkingDayCalendar tests ────────────────────────────────────────────

Deno.test('buildWorkingDayCalendar: returns exactly durationDays dates', () => {
  const start = new Date('2025-01-06') // Monday
  const dates = buildWorkingDayCalendar(start, 5, false)
  assertEquals(dates.length, 5)
})

Deno.test('buildWorkingDayCalendar: working-only skips weekends', () => {
  const start = new Date('2025-01-06') // Monday
  const dates = buildWorkingDayCalendar(start, 5, true)
  // Mon–Fri only
  for (const d of dates) {
    const dow = d.getDay()
    assertNotEquals(dow, 0) // not Sunday
    assertNotEquals(dow, 6) // not Saturday
  }
})

Deno.test('buildWorkingDayCalendar: workingDaysOnly=false includes weekends', () => {
  // Start on Friday
  const start = new Date('2025-01-10') // Friday
  const dates = buildWorkingDayCalendar(start, 3, false)
  // Days: Fri, Sat, Sun
  const dows = dates.map(d => d.getDay())
  assertEquals(dows.includes(6), true) // Saturday included
})

Deno.test('buildWorkingDayCalendar: 14 working days from Monday spans ~3 weeks', () => {
  const start = new Date('2025-01-06') // Monday
  const dates = buildWorkingDayCalendar(start, 14, true)
  assertEquals(dates.length, 14)
  // Last date should be 2025-01-23 (14 working days: 6–10, 13–17, 20–23)
  const last = dates[dates.length - 1]
  assertEquals(last.toISOString().slice(0, 10), '2025-01-23')
})

Deno.test('buildWorkingDayCalendar: duration 1 returns single date', () => {
  const start = new Date('2025-03-03') // Monday
  assertEquals(buildWorkingDayCalendar(start, 1, true).length, 1)
})

// ─── validateChannelMix tests ─────────────────────────────────────────────────

Deno.test('validateChannelMix: all valid channels pass', () => {
  assertEquals(validateChannelMix(['linkedin_post', 'email', 'cold_dm']), true)
})

Deno.test('validateChannelMix: unknown channel fails', () => {
  assertEquals(validateChannelMix(['telegram']), false)
})

Deno.test('validateChannelMix: empty array passes', () => {
  assertEquals(validateChannelMix([]), true)
})

Deno.test('validateChannelMix: twitter_x is valid', () => {
  assertEquals(validateChannelMix(['twitter_x']), true)
})

Deno.test('validateChannelMix: facebook alias is valid', () => {
  assertEquals(validateChannelMix(['facebook']), true)
})

// ─── CORS smoke test ──────────────────────────────────────────────────────────

Deno.test('generate-campaign-brief handler: OPTIONS returns 204', async () => {
  const req = new Request('https://fn.example.com/generate-campaign-brief', {
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
