---
description: "Week 3 — Image generation: build-prompt, generate-asset (images), poll-job-status, check-quota, submit-feedback, /create prompt editor, /create/[job_id] result page, Realtime job progress."
agent: agent
tools: [supabase]
---

# Week 3 — Prompt Editor and Image Generation

Read the master spec at [gtm.md](../../gtm.md) Sections 5, 6, 7.1, 11.4, 11.5. Weeks 1 and 2 must be complete before starting.

## STOP CHECK
Call `list_migrations` — must show 0001–0006. Check ingest-signals logs with `get_logs` — must be healthy.

---

## PART 1 — Complete Provider Adapters

Complete the AI provider adapters (stubs were created in Week 1):

### _shared/providers/openrouter.ts (full implementation)
```typescript
export async function callOpenRouter(
  modelId: string,
  messages: {role: string, content: string}[],
  opts: {max_tokens?: number, temperature?: number},
  apiKey: string,
  orgId: string,
  orgSlug: string,
  jobId: string | null,
  stepKey: string
): Promise<{content: string, usage: {prompt_tokens: number, completion_tokens: number, total_tokens: number}}> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: modelId,
      messages,
      ...opts,
      // REQUIRED for OpenRouter Broadcast → Langfuse per-client filtering (spec Section 20.2)
      user: orgId,
      session_id: jobId ?? 'no-job',
      trace: {org_id: orgId, org_slug: orgSlug, step_key: stepKey, job_id: jobId}
    })
  })
  if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`)
  const data = await response.json()
  return {content: data.choices[0].message.content, usage: data.usage}
}

export async function callOpenRouterImage(
  modelId: string, prompt: string, opts: {aspect_ratio?: string, image_size?: string},
  apiKey: string, orgId: string, orgSlug: string, jobId: string
): Promise<string> {
  // IMPORTANT: OpenRouter image generation uses /api/v1/chat/completions with modalities param.
  // There is NO /api/v1/images/generations endpoint on OpenRouter — that is an OpenAI-only endpoint.
  const body: Record<string, unknown> = {
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    modalities: ['image', 'text'],  // use ['image'] for image-only models (flux, sourceful)
    user: orgId,
    session_id: jobId,
    trace: { org_id: orgId, org_slug: orgSlug, step_key: 'image_generation', job_id: jobId },
  }
  if (opts.aspect_ratio || opts.image_size) {
    body.image_config = {
      ...(opts.aspect_ratio ? { aspect_ratio: opts.aspect_ratio } : {}),
      ...(opts.image_size   ? { image_size: opts.image_size }     : {}),
    }
  }
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`OpenRouter image error: ${response.status}`)
  const data = await response.json()
  // Image is in message.images[], NOT in message.content
  const images = data.choices?.[0]?.message?.images
  if (!images?.length) throw new Error('openrouter_image_no_output')
  return images[0].image_url.url  // base64 data URL: 'data:image/png;base64,...'
}
```

### _shared/providers/fal.ts (full implementation)
```typescript
import * as fal from 'npm:@fal-ai/client'

export async function callFal(modelId: string, payload: any, apiKey: string) {
  fal.config({credentials: apiKey})
  // Submit to fal.ai queue (async)
  const { request_id } = await fal.queue.submit(modelId, {input: payload})
  return {request_id, status: 'pending'}
}

export async function pollFalJob(modelId: string, requestId: string, apiKey: string) {
  fal.config({credentials: apiKey})
  const status = await fal.queue.status(modelId, {requestId: requestId, logs: false})
  if (status.status === 'COMPLETED') {
    const result = await fal.queue.result(modelId, {requestId: requestId})
    return {status: 'completed', result}
  }
  return {status: status.status.toLowerCase()}
}
```

### _shared/providers/google_ai_studio.ts
`callGoogleAIStudio(modelId, payload, apiKey)` — call Google Generative Language REST API.
- For text: POST `https://generativelanguage.googleapis.com/v1beta/models/{modelId}:generateContent?key={apiKey}`
- For images: POST `https://generativelanguage.googleapis.com/v1beta/models/{modelId}:generateContent?key={apiKey}` with image generation parameters
- Call `recordUsage` (from observability.ts) after every call — on both success and failure

### _shared/providers/anthropic.ts
`callAnthropic(modelId, messages, apiKey)` — POST `https://api.anthropic.com/v1/messages` with headers `x-api-key: {key}`, `anthropic-version: 2023-06-01`. Call `recordUsage` after every call.

### _shared/providers/openai.ts
`callOpenAI(modelId, messages, apiKey)` — POST `https://api.openai.com/v1/chat/completions`. `embedText(text, modelId, apiKey)` — POST `https://api.openai.com/v1/embeddings`. Call `recordUsage` after every call.

### _shared/providers/router.ts (full implementation)
```typescript
export async function resolveApiKey(supabase: any, orgId: string, providerKey: string, keySource: string): Promise<string> {
  const platformKeyMap: Record<string, string> = {
    openrouter: 'OPENROUTER_DEFAULT_API_KEY',
    fal: 'FAL_API_KEY',
    google_ai_studio: 'GOOGLE_AI_STUDIO_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
  }

  // Step 1: Check org key
  const {data: orgKey} = await supabase.from('org_provider_api_keys').select('encrypted_key').eq('org_id', orgId).eq('provider_key', providerKey).maybeSingle()
  if (orgKey) return decrypt(orgKey.encrypted_key, Deno.env.get('ENCRYPTION_KEY')!)

  // Step 2: Apply key_source rules
  if (keySource === 'user_required') {
    throw new Response(JSON.stringify({error: `This model requires your own ${providerKey} API key. Add it in Settings → Model Settings.`}), {status: 403})
  }
  // keySource === 'platform' or 'user_or_platform': use platform env var
  const platformKey = Deno.env.get(platformKeyMap[providerKey])
  if (!platformKey) throw new Response(JSON.stringify({error: `No API key found for ${providerKey}. Add your key in Settings → Model Settings.`}), {status: 403})
  return platformKey
}

export async function routeGeneration(providerKey: string, modelId: string, payload: any, apiKey: string, orgId: string, orgSlug: string, jobId: string): Promise<any> {
  switch (providerKey) {
    case 'openrouter': return callOpenRouterImage(modelId, payload.prompt, payload, apiKey, orgId, orgSlug, jobId)
    case 'fal': return callFal(modelId, payload, apiKey)
    case 'google_ai_studio': return callGoogleAIStudio(modelId, payload, apiKey)
    case 'anthropic': return callAnthropic(modelId, payload.messages, apiKey)
    case 'openai': return callOpenAI(modelId, payload.messages, apiKey)
    default: throw new Error(`Unknown provider: ${providerKey}`)
  }
}
```

---

## PART 2 — build-prompt Edge Function

Create `supabase/functions/build-prompt/index.ts`. POST — any authenticated org member.

### Input:
`{signal_id?: string, prompt_tags: {subject, visual_style, mood, colour_palette, platform, aspect_ratio, cta_text, negative_prompt, additional_notes}}`

### Logic:
1. Extract `org_id` from JWT (`user.app_metadata.org_id`)
2. Fetch `brand_contexts WHERE org_id = $org_id` — single SELECT (one row per org). Do NOT use pgvector similarity search in v1. (spec Section 6 NOTE: pgvector is for future multi-org retrieval — v1 uses direct SELECT)
3. Fetch signal by `signal_id` if provided
4. Query `org_slug` from orgs: `SELECT slug FROM orgs WHERE id = $org_id` (needed for ContentJob JSON)
5. Resolve model for `step_key = 'image_generation'`:
   - Check `org_model_preferences WHERE org_id = $org_id AND step_key = 'image_generation'`
   - Fallback to `available_models WHERE default_for_step_key = 'image_generation'`
6. Assemble `brand_context_summary`:
   - Concatenate: `one_sentence_pitch + '\n' + extended_description + '\nThemes: ' + active_themes.join(', ') + '\nAudience: ' + decision_maker_titles.join(', ')`
   - If `brand_guidelines_text` is not null: prepend `'Brand Guidelines:\n' + brand_guidelines_text + '\n\n'`
7. Build `compiled_prompt`:
   ```
   You are creating a B2B marketing {asset_type} for {company_name}.
   Brand context: {brand_context_summary}
   Voice examples: {voice_examples.join('\n---\n')}
   Trend context: {signal_headline}: {signal_summary}
   Subject: {prompt_tags.subject}
   Style: {prompt_tags.visual_style}, Mood: {prompt_tags.mood}
   Colour palette: {prompt_tags.colour_palette}
   Platform: {prompt_tags.platform}, Aspect ratio: {prompt_tags.aspect_ratio}
   CTA: {prompt_tags.cta_text}
   Additional: {prompt_tags.additional_notes}
   Do not reference: {competitor_names.join(', ')}
   ```
8. Build `compiled_negative`:
   - Combine: `prompt_tags.negative_prompt + ', ' + topics_to_avoid.join(', ') + ', ' + visual_styles_to_avoid.join(', ')`
9. Assemble full `ContentJob` JSON (spec Section 6 schema)
10. Return the ContentJob JSON — do NOT insert into DB, do NOT call any AI model

---

## PART 3 — check-quota Edge Function

Create `supabase/functions/check-quota/index.ts`. GET — any authenticated org member.
- Fetch from orgs: `SELECT plan_tier, image_quota, image_used, video_quota, video_used, quota_reset_at WHERE id = $org_id`
- Returns: `{plan_tier, image_quota, image_used, video_quota, video_used, quota_reset_at}`
- No writes. Fast path — call before showing Generate button in UI.

---

## PART 4 — generate-asset Edge Function

Create `supabase/functions/generate-asset/index.ts`. POST — any authenticated org member.

### Input: `{content_job: ContentJobJSON, model_id?: string, provider_key?: string}`

### Logic (spec Section 5 generate-asset):
1. Extract `org_id` from JWT
2. If `model_id` + `provider_key` NOT provided in request: resolve from `org_model_preferences` for step_key based on asset_type, fall back to `available_models` default
3. Fetch model row: `SELECT key_source, estimated_time_seconds FROM available_models WHERE provider_key = $provider_key AND model_id = $model_id`
4. **Quota check**: call check-quota internally. If `image_used >= image_quota` (for image) or `video_used >= video_quota` (for video) → HTTP 402 `{error: 'quota_exceeded', quota_type: 'image'|'video'}`
5. Check `plan_tier`: if `requires_paid_plan = true` on the model and `plan_tier = 'starter'` → HTTP 403 `{error: 'model_requires_paid_plan'}`
6. Resolve API key: call `resolveApiKey(supabase, org_id, provider_key, model.key_source)` — this throws HTTP 403 if no key available
7. Query `org_slug`: `SELECT slug FROM orgs WHERE id = $org_id`
8. Write `generation_jobs` row: status='pending', content_job_json, prompt_tags, model_id, provider_key, signal_id, asset_type, created_by=user.id
9. Increment quota: `UPDATE orgs SET image_used = image_used + 1 WHERE id = $org_id` (or video_used)
10. **Fast image models** (`estimated_time_seconds < 30`): call `routeGeneration()` synchronously, wait for result, update job to status='completed', save asset to Storage, return `{job_id, status: 'completed', output_url}`
11. **Video and slow models** (`estimated_time_seconds >= 30`): call `routeGeneration()`, get back `{request_id}`, store in `generation_jobs.openrouter_job_id`, return immediately `{job_id, status: 'pending'}`. NEVER block HTTP response > 30s.

### Storage save (for fast synchronous image completion):
```typescript
const assetBuffer = await downloadAsset(resultUrl) // fetch the image bytes
const ext = content_job.asset_type === 'video' ? 'mp4' : 'png'
const storagePath = `assets/${org_id}/${job_id}.${ext}`
await supabase.storage.from('assets').upload(storagePath, assetBuffer, {contentType: ext === 'mp4' ? 'video/mp4' : 'image/png'})
```

---

## PART 5 — poll-job-status Edge Function

Create `supabase/functions/poll-job-status/index.ts`. CRON-TRIGGERED — NO JWT user check, NO requireRole. Uses service role client. Called every 1 minute by pg_cron.

### Logic:
1. Query: `SELECT * FROM generation_jobs WHERE status IN ('pending', 'processing') AND poll_count < 60`
2. For each job:
   a. Increment `poll_count`
   b. Resolve API key: look up `org_provider_api_keys` for the job's `provider_key` and `org_id`, decrypt. Fallback to platform env var.
   c. Call the correct polling function based on `provider_key`:
      - `fal`: call `pollFalJob(job.model_id, job.openrouter_job_id, apiKey)`
      - `openrouter`: call OpenRouter job status endpoint
      - `google_ai_studio`: poll Veo operation status
   d. If `result.status === 'completed'`:
      - Download generated asset bytes
      - Upload to Supabase Storage: `assets/{org_id}/{job_id}.{ext}` using service role client
      - UPDATE generation_jobs: `status='completed', output_url=storagePath, completed_at=now(), generation_time_ms=elapsed`
      - **Fire Realtime broadcast**: `await supabase.channel('job:{job_id}').send({type: 'broadcast', event: 'job_complete', payload: {job_id, status: 'completed', output_url: storagePath}})`
      - For video jobs: send Resend email (stub for Week 3 — implement fully in Week 4)
   e. If `result.status === 'failed'`:
      - UPDATE generation_jobs: `status='failed', error_message=result.error`
   f. If `poll_count >= 60` and still not complete: UPDATE status='failed', error_message='Generation timed out'
3. Return `{polled: N, completed: M, failed: K}`

---

## PART 6 — submit-feedback Edge Function

Create `supabase/functions/submit-feedback/index.ts`. POST — any authenticated org member.
- Accepts `{job_id, rating?: integer 1-5, thumbs?: 'up'|'down', note?: string, tags_changed?: jsonb, regenerated?: boolean}`
- Validate: at least one of `rating` or `thumbs` must be provided → HTTP 400 if both absent
- INSERT into `generation_feedback`
- Returns `{saved: true, feedback_id}`

---

## PART 7 — /create Prompt Tag Editor

Create `apps/web/app/(dashboard)/create/page.tsx` and components in `apps/web/components/generation/`.

### URL params: `?signal_id={id}` pre-loads a signal

### Layout:
**Left panel (2/3 width) — Tag editor form:**
- Subject (text input, required)
- Visual Style (select: Photography | Illustration | Abstract | 3D | Flat)
- Mood (select: Professional | Bold | Calm | Energetic | Minimal | Playful | Sophisticated)
- Colour Palette (text, pre-filled from brand_colours hex values as "Primary: #xxx, Secondary: #xxx, Accent: #xxx")
- Platform (select: LinkedIn | Instagram | Twitter | Generic)
- Aspect Ratio (select: 1:1 | 16:9 | 9:16 | 4:5)
- CTA Text (text input, optional)
- Negative Prompt (textarea, pre-filled from brand: topics_to_avoid + phrases_to_avoid + visual_styles_to_avoid joined with comma)
- Additional Notes (textarea, optional)
- 'View JSON' toggle button — reveals full ContentJob JSON in a code editor (shadcn Textarea styled as code). Editing JSON updates form fields in real-time (bidirectional). Editing form fields updates JSON. Use `useState` + `useEffect` to keep in sync.

**Right panel (1/3 width) — Brand context sidebar:**
- Shows org's brand context that will be injected: brand colours swatches, tone summary (5 sliders rendered as read-only tags), active_themes list, decision_maker_titles

### Model selector (below form, above Generate button):
- Calls `get-available-models` Edge Function on page load (implement the GET function if not yet done — full Week 6, but needs stub returning DB data for Week 3)
- Groups models by type: Image | Video
- For each model: name, provider badge, cost_tier badge, estimated_time_seconds badge ('~30s', '~5min'), lock icon if org has no key for that provider
- Pre-selected: org's saved preference from org_model_preferences for image_generation
- User can override for this single job

### Generate button:
1. Calls check-quota Edge Function first. If `image_used >= image_quota` → show upgrade modal (spec Section 13.1 plan pricing). Don't call generate-asset.
2. Calls build-prompt Edge Function with current form values
3. Calls generate-asset Edge Function with the ContentJob + selected model
4. For image (fast): show spinner on the button. On completion: redirect to `/create/{job_id}`
5. For video (slow): show 'Job submitted!' toast. Redirect to /dashboard. Job progress shown via Realtime on dashboard.

### Realtime subscription for job progress on /create:
```typescript
const channel = supabase.channel(`job:${jobId}`)
channel.on('broadcast', {event: 'job_complete'}, ({payload}) => {
  router.push(`/create/${payload.job_id}`)
}).subscribe()
```

---

## PART 8 — /create/[job_id] Result Page

Create `apps/web/app/(dashboard)/create/[job_id]/page.tsx`.

### Content:
- Fetch `generation_jobs WHERE id = $job_id AND org_id = $org_id` — verify org ownership
- If status = 'pending' or 'processing': show job progress UI with Realtime subscription
- If status = 'failed': show error message + 'Try again' button → /create with same prompt_tags pre-loaded

**Image result:**
- Full-width image from a **signed URL** (1-hour expiry). Generate via Edge Function or Supabase client: `supabase.storage.from('assets').createSignedUrl(output_url, 3600)`. NEVER serve a direct public URL.
- Download button: fetch signed URL → download as `{org_slug}_{date}_{job_id.slice(0,8)}.png`
- Filename format from spec: `{org_slug}_{date}_{job_id_short}.png`

**Feedback panel:**
- Thumbs up / Thumbs down toggle (shadcn Button variants)
- 1-5 star rating (shadcn custom stars or rating component)
- Optional text note (shadcn Textarea)
- Submit → calls submit-feedback Edge Function

**'Regenerate with changes' button:**
- Navigates to /create with current `prompt_tags` pre-loaded as URL params or session state
- Changed fields highlighted in yellow on /create (track which fields differ from original)

**Version history sidebar:**
- Query: `SELECT id, prompt_tags, created_at, output_url FROM generation_jobs WHERE (id = $job_id OR parent_job_id = $job_id OR id = (SELECT parent_job_id FROM generation_jobs WHERE id = $job_id)) AND org_id = $org_id ORDER BY created_at ASC`
- Show thumbnail (signed URL) + version number for each

**'Use for campaign' button:**
- Navigate to /icp with `?job_id={job_id}` pre-selected

---

## PART 9 — Realtime job progress on /dashboard

Extend /dashboard to show in-progress generation jobs:
- Query `generation_jobs WHERE org_id = $org_id AND status IN ('pending', 'processing') AND created_by = user.id`
- For each in-progress job: show a progress card with job_id, asset_type, model_id, spinner
- Subscribe to Supabase Realtime channel `job:{job_id}` for each active job
- On `job_complete` event: update card to show thumbnail (if image) or 'Video ready!' link + navigate to /create/[job_id]

---

## PART 10 — Verification

Install shadcn components: `npx shadcn@latest add dialog progress slider`

**End-of-week test (spec Section 17 Week 3):**
1. Select a trend from /dashboard → navigated to /create with signal pre-loaded
2. Fill in Subject and other tags
3. Click Generate (image model — estimated < 30s)
4. Image appears in /create/[job_id] within ~30 seconds
5. Rate it 3 stars
6. Click 'Regenerate with changes' — change Subject tag
7. Generate again — new version appears
8. Click Download — file downloads as `{org_slug}_YYYYMMDD_{short_id}.png`
9. Both versions appear in version history sidebar
10. Check `get_logs` on generate-asset and poll-job-status — no errors
