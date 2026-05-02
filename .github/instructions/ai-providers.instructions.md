---
description: "Use when writing AI provider adapters, model selection logic, prompt assembly, or any code that calls AI APIs. Covers provider routing, key resolution, model ID rules, observability, and cost tracking."
applyTo: "supabase/functions/_shared/providers/**"
---

# AI Provider Guidelines

## Never hardcode model IDs

```typescript
// WRONG — never do this
const modelId = 'gemini-3-flash-preview'

// RIGHT — always resolve from DB
const { data: pref } = await supabase
  .from('org_model_preferences')
  .select('model_id, provider_key')
  .eq('org_id', org_id)
  .eq('step_key', step_key)
  .maybeSingle()

const { data: defaultModel } = await supabase
  .from('available_models')
  .select('model_id, provider_key, key_source')
  .eq('default_for_step_key', step_key)
  .eq('is_active', true)
  .single()

const modelId = pref?.model_id ?? defaultModel.model_id
const providerKey = pref?.provider_key ?? defaultModel.provider_key
```

## Key resolution (resolveApiKey in router.ts)

Priority: org key (decrypted from `org_provider_api_keys`) → platform env var → HTTP 403

```typescript
// key_source from available_models table:
// 'platform'          → always use platform env var, never org key
// 'user_or_platform'  → org key if present, else platform env var
// 'user_required'     → HTTP 403 if no org key exists
```

Platform env var map:
| provider_key | env var |
|---|---|
| openrouter | OPENROUTER_DEFAULT_API_KEY |
| fal | FAL_API_KEY |
| google_ai_studio | GOOGLE_AI_STUDIO_API_KEY |
| anthropic | ANTHROPIC_API_KEY |
| openai | OPENAI_API_KEY |


## OpenRouter image generation — DIFFERENT from text calls

> Image generation via OpenRouter uses the SAME `/api/v1/chat/completions` endpoint
> but requires `modalities` in the request and returns images in a different field.
> **Do NOT use `message.content` for image responses — use `message.images[]`.**
>
> **Consult the `openrouter-image-gen` skill** for the full contract: modalities logic,
> image_config reference, model discovery, base64→Storage upload pattern, and error handling.

### Request format (image via OpenRouter)

```typescript
// In openrouter.ts callOpenRouter() — extend to accept optional modalities param
const body = {
  model: modelId,
  messages: [{ role: 'user', content: prompt }],
  modalities: modalities ?? ['text'],   // ['image', 'text'] or ['image'] for image models
  ...(imageConfig ? { image_config: imageConfig } : {}),
  // OpenRouter Broadcast fields — required for Langfuse per-org filtering
  user: org_id,
  session_id: job_id ?? 'ingest',
  trace: { org_id, org_slug, step_key, job_id: job_id ?? null },
}

// image_config is optional — use for size/aspect control:
// { aspect_ratio: '16:9', image_size: '4K' }
// aspect_ratio options: '1:1'(default), '16:9', '9:16', '4:3', '3:2', '2:3', '3:4', '21:9'
// image_size options: '1K'(default), '2K', '4K'
```

### Response extraction (image via OpenRouter)

```typescript
// Text call:  response.choices[0].message.content  (string)
// Image call: response.choices[0].message.images[0].image_url.url  (base64 data URL)

const message = response.choices[0].message

if (modalities?.includes('image')) {
  const images = message.images ?? []
  if (images.length === 0) throw new Error('openrouter_image_no_output')
  const base64DataUrl = images[0].image_url.url   // "data:image/png;base64,..."
  // Upload base64DataUrl to Supabase Storage — strip the data: prefix first
  const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '')
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  await supabase.storage.from('assets').upload(`${org_id}/${job_id}.png`, bytes, { contentType: 'image/png' })
} else {
  const text = message.content  // normal text response
}
```

### Which provider_key uses which call pattern

| provider_key | image generation call | async? |
|---|---|---|
| `fal` | `callFal(modelId, payload, apiKey)` via `@fal-ai/client` queue | YES — always async, poll via `poll-job-status` |
| `openrouter` text | `callOpenRouter(modelId, prompt, opts, apiKey, orgSlug)` | NO — synchronous text response |
| `openrouter` image | `callOpenRouterImage(modelId, compiledPrompt, imageConfig, modalities, apiKey, orgSlug, orgId, jobId)` | NO — synchronous image response, base64→Storage in generate-asset |
| `google_ai_studio` | `callGoogleAIStudio(modelId, payload, apiKey)` via Gemini REST | NO — synchronous for image, YES for video |

### OpenRouter image-capable model IDs (for available_models seed)

```
google/gemini-3.1-flash-image-preview   — Google Gemini image + text output (GTM default)
google/gemini-2.5-flash-image           — Google Gemini image + text output (cheaper)
black-forest-labs/flux.2-pro            — FLUX.2 Pro, image-only output
black-forest-labs/flux.2-flex           — FLUX.2 Flex, image-only output
sourceful/riverflow-v2-standard-preview  — Sourceful, image-only output
```

> **`openai/gpt-image-1` and `openai/gpt-image-2` are NOT available on OpenRouter (May 2026).**
> For OpenAI image generation use `gpt-image-2` via direct `openai.ts` (`POST /v1/images/generations`),
> response in `data[0].b64_json` (base64 PNG). Do NOT seed `openai/gpt-image-*` in the OpenRouter provider rows.

> Discover more via API: `GET https://openrouter.ai/api/v1/models?output_modalities=image`
> Or filter `fetchOpenRouterModelList()` client-side: `.filter(m => m.output_modalities?.includes('image'))`
## OpenRouter calls — always include org tagging

```typescript
// Required fields in every OpenRouter request body for Langfuse Broadcast filtering
const body = {
  model: modelId,
  messages: [...],
  user: org_id,                       // primary per-client filter in Langfuse
  session_id: job_id ?? 'ingest',
  trace: {
    org_id,
    org_slug,                          // query from orgs table — NOT in JWT
    step_key,
    job_id: job_id ?? null,
  },
}
// org_slug is NOT in JWT — query once: SELECT slug FROM orgs WHERE id = $org_id
```

**openrouter.ts does NOT call `recordUsage`** — OpenRouter Broadcast handles all OpenRouter traces automatically.

## Non-OpenRouter providers — always call recordUsage

```typescript
// fal.ts, google_ai_studio.ts, anthropic.ts, openai.ts — required after every API call
const startTime = Date.now()
let success = true, errorCode: string | undefined

try {
  const response = await callProvider(...)
  return response
} catch (err) {
  success = false
  errorCode = err.code ?? 'unknown'
  throw err
} finally {
  await recordUsage(supabase, {
    org_id, org_slug, provider_key, model_id, step_key, job_id,
    key_source_used,
    prompt_tokens: response?.usage?.prompt_tokens ?? null,
    completion_tokens: response?.usage?.completion_tokens ?? null,
    total_tokens: response?.usage?.total_tokens ?? null,
    estimated_cost_usd: computeCost(model, response?.usage),
    latency_ms: Date.now() - startTime,
    success,
    error_code: errorCode ?? null,
  })
}
```

## Langfuse SDK in observability.ts (Deno)

```typescript
import Langfuse from 'npm:langfuse'

// Create client only if env var is set
const langfuse = Deno.env.get('LANGFUSE_PUBLIC_KEY')
  ? new Langfuse({
      publicKey: Deno.env.get('LANGFUSE_PUBLIC_KEY')!,
      secretKey: Deno.env.get('LANGFUSE_SECRET_KEY')!,
      baseUrl: Deno.env.get('LANGFUSE_HOST') ?? 'https://cloud.langfuse.com',
    })
  : null

// CRITICAL: always shutdownAsync() in finally block
// Edge Functions have no persistent event loop — this is the only way to flush
try {
  if (langfuse) {
    const trace = langfuse.trace({ userId: org_id, sessionId: job_id, metadata: { org_id, org_slug, step_key } })
    trace.generation({ model: model_id, usage: { promptTokens, completionTokens }, input, output })
  }
} catch { /* swallow */ } finally {
  if (langfuse) await langfuse.shutdownAsync()
}
```


## fal.ai model endpoint IDs

> Consult the `fal-models-catalog` skill for current endpoint IDs by modality.
> Use these IDs when seeding `available_models` in migrations (Week 1) and in
> the `get-available-models` Edge Function (Week 6).

| Modality | Reference |
|---|---|
| Text to Image | `fal-models-catalog/references/text-to-image.md` |
| Text to Video | `fal-models-catalog/references/text-to-video.md` |
| Image to Video | `fal-models-catalog/references/image-to-video.md` |

GTM Engine recommended defaults for `available_models` seed:
- Image (default via fal): `fal-ai/nano-banana-2` (Gemini 3.1 Flash — best quality on fal.ai)
- Image (budget via fal): `fal-ai/nano-banana` (Gemini 2.5 Flash — faster/cheaper)
- Image (default via OpenRouter): `google/gemini-3.1-flash-image-preview`
- Video (default): `fal-ai/kling-video/v3/standard/text-to-video`
- Video premium: `bytedance/seedance-2.0/text-to-video`
## fal.ai async pattern + response handling

```typescript
import { fal } from 'npm:@fal-ai/client'
fal.config({ credentials: apiKey })

// Submit job (always async queue — never use fal.subscribe in Edge Functions)
const { request_id } = await fal.queue.submit(modelId, { input: buildFalInput(modelId, contentJob) })

// Poll (called by poll-job-status cron)
const result = await fal.queue.result(modelId, { requestId: request_id })

// fal.ai returns a HOSTED URL — not base64. Must fetch → upload to Storage.
const imageUrl = result.data.images[0].url   // e.g. "https://v3.fal.media/files/..."
const resp = await fetch(imageUrl)
const bytes = new Uint8Array(await resp.arrayBuffer())
await supabase.storage.from('assets').upload(`${orgId}/${jobId}.png`, bytes, { contentType: 'image/png', upsert: true })
// NEVER store the v3.fal.media URL — it is ephemeral and expires
```

## fal.ai input schema per model

**Each model uses different input fields.** Build the `input` object in `callFal()` based on `modelId`:

### `fal-ai/nano-banana-2` (Gemini 3.1 Flash — preferred default)
```typescript
{
  prompt: contentJob.compiled_prompt + '\n\nNegative: ' + contentJob.compiled_negative,
  aspect_ratio: contentJob.prompt_tags.aspect_ratio ?? 'auto',  // 'auto','1:1','16:9','9:16','4:5','4:1','1:4','8:1','1:8'
  resolution: '2K',          // '0.5K'|'1K'|'2K'|'4K' — use 2K for social media quality
  num_images: 1,
  output_format: 'png',
  seed: contentJob.seed ?? undefined,
}
```

### `fal-ai/nano-banana` (Gemini 2.5 Flash — cheaper/faster)
```typescript
{
  prompt: contentJob.compiled_prompt + '\n\nNegative: ' + contentJob.compiled_negative,
  aspect_ratio: mapAspectRatio(contentJob.prompt_tags.aspect_ratio),  // see mapping below
  num_images: 1,
  output_format: 'png',
  seed: contentJob.seed ?? undefined,
  // NO resolution param on this model
}
// aspect_ratio enum: '21:9','16:9','3:2','4:3','5:4','1:1','4:5','3:4','2:3','9:16'
// ContentJob '4:5' → '4:5' ✓  |  '9:16' → '9:16' ✓  |  null → '1:1'
```

### `fal-ai/bytedance/seedream/v4/text-to-image`
```typescript
{
  prompt: contentJob.compiled_prompt + '\n\nNegative: ' + contentJob.compiled_negative,
  image_size: mapToFalImageSize(contentJob.prompt_tags.aspect_ratio),  // see mapping below
  num_images: 1,
  enhance_prompt_mode: 'standard',
  seed: contentJob.seed ?? undefined,
  // NO aspect_ratio param — uses image_size named enum
}
// image_size mapping: '1:1'→'square_hd', '16:9'→'landscape_16_9', '9:16'→'portrait_16_9', '4:5'→'portrait_4_3'
```

### `fal-ai/qwen-image`
```typescript
{
  prompt: contentJob.compiled_prompt,      // positive only
  negative_prompt: contentJob.compiled_negative,  // ← native field, do NOT embed in prompt
  image_size: mapToFalImageSize(contentJob.prompt_tags.aspect_ratio),
  num_images: 1,
  output_format: 'png',
  use_turbo: true,           // faster generation
  seed: contentJob.seed ?? undefined,
}
```

### `fal-ai/flux-pro/kontext/max/text-to-image`
```typescript
{
  prompt: contentJob.compiled_prompt + '\n\nNegative: ' + contentJob.compiled_negative,
  aspect_ratio: mapAspectRatio(contentJob.prompt_tags.aspect_ratio),
  guidance_scale: 3.5,
  num_images: 1,
  output_format: 'png',      // default is 'jpeg' — override to png for lossless Storage upload
  enhance_prompt: true,
  seed: contentJob.seed ?? undefined,
}
// aspect_ratio enum: '21:9','16:9','4:3','3:2','1:1','2:3','3:4','9:16','9:21'
```

### Helper: aspect_ratio → fal image_size (for Seedream + Qwen)
```typescript
function mapToFalImageSize(ar: string | null): string {
  const map: Record<string, string> = {
    '1:1': 'square_hd', '16:9': 'landscape_16_9',
    '9:16': 'portrait_16_9', '4:5': 'portrait_4_3',
    '3:2': 'landscape_4_3', '2:3': 'portrait_4_3',
  }
  return map[ar ?? '1:1'] ?? 'square_hd'
}
```

## Cost estimation

```typescript
function computeCost(model: AvailableModel, usage?: TokenUsage): number | null {
  if (!usage || !model.cost_per_1k_input_tokens) return null
  return (usage.prompt_tokens / 1000 * model.cost_per_1k_input_tokens)
       + (usage.completion_tokens / 1000 * (model.cost_per_1k_output_tokens ?? 0))
}
```

## Structured outputs — provider config when expecting JSON from LLM

When `build-prompt` (or any step) asks an LLM to return a ContentJob JSON object, pass the schema
to the provider to constrain generation server-side, AND validate the response with Zod as a backstop.
Import the schema exports from `_shared/schemas.ts`.

### OpenRouter (text models) + OpenAI direct

```typescript
import { ContentJobJsonSchema } from '../_shared/schemas.ts'

// Add to request body in callOpenRouter() when step_key === 'prompt_assembly':
const body = {
  model: modelId,
  messages: [...],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'ContentJob',
      strict: true,
      schema: ContentJobJsonSchema,   // plain JSON Schema object from schemas.ts
    },
  },
  // ... user/session_id/trace fields as normal
}
// Response still in choices[0].message.content — but guaranteed valid JSON matching schema
```

### Google AI Studio (Gemini text models)

```typescript
import { ContentJobGeminiSchema } from '../_shared/schemas.ts'

// Add to generationConfig in callGoogleAIStudio() when expecting JSON:
const requestBody = {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: ContentJobGeminiSchema,  // Gemini-compatible schema from schemas.ts
  },
}
// Response in candidates[0].content.parts[0].text — parse with JSON.parse()
```

### Anthropic (Claude models)

```typescript
import { ContentJobJsonSchema } from '../_shared/schemas.ts'

// Add header + response_format to callAnthropic() when expecting JSON:
const headers = {
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'json-schema-2025-05-01',   // required for structured output
  'content-type': 'application/json',
}
const body = {
  model: modelId,
  messages: [...],
  response_format: {
    type: 'json',
    json_schema: ContentJobJsonSchema,
  },
}
// Response still in content[0].text — parse with JSON.parse()
```

## Zod response validation (ALL providers — always validate LLM JSON output)

```typescript
import { z } from 'npm:zod'
import { ContentJobSchema, type ContentJob } from '../_shared/schemas.ts'

// After receiving text from ANY provider when expecting JSON:
let contentJob: ContentJob
try {
  contentJob = ContentJobSchema.parse(JSON.parse(llmText))
} catch (err) {
  if (err instanceof z.ZodError) {
    console.error('LLM JSON failed schema validation', err.flatten())
    // Return 422 — do NOT store invalid output in generation_jobs
    throw { status: 422, error: 'llm_output_invalid', details: err.flatten() }
  }
  throw err
}
// Safe to use contentJob — all fields typed and bounds-checked
```

> **Why both?** Provider structured outputs prevent most malformed responses. Zod catches the rare
> cases where the provider ignores the schema (network error, model fallback, streaming corruption).
> Together they guarantee the ContentJob stored in `generation_jobs.content_job_json` always matches
> the schema — preventing silent data corruption that would only manifest as a crash in `generate-asset`.
