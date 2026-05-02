---
description: "Use when writing Supabase Edge Functions (Deno/TypeScript) — covers JWT validation, CORS, error handling, service role client, provider routing, encryption, and shared utility usage."
applyTo: "supabase/functions/**"
---

# Edge Function Guidelines

## Runtime and imports

Deno runtime. Import npm packages with `npm:` prefix:
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import Langfuse from 'npm:langfuse'
import * as pdfjs from 'npm:pdfjs-dist/legacy/build/pdf.js'
```

## Standard function skeleton

```typescript
import { validateJWT, requireRole } from '../_shared/auth.ts'
import { createSupabaseClient } from '../_shared/db.ts'

const ALLOWED_ORIGINS = [
  'https://gtmengine.qubitlyventures.com',
  'http://localhost:3000',
]

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? ''

  // CORS preflight
  if (req.method === 'OPTIONS') {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(null, { status: 403 })
    }
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    })
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  }

  const corsHeaders = { 'Access-Control-Allow-Origin': origin }

  try {
    // 1. Validate JWT and extract org_id
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
    const supabase = createSupabaseClient(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // 2. Get org_id from JWT claims ONLY — never from request body or URL
    const org_id = user.app_metadata?.org_id as string | undefined
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'no_org' }), { status: 401, headers: corsHeaders })
    }

    // 3. Check role (use for write/admin operations)
    // requireRole(user, 'admin') — throws if role < admin

    const body = await req.json()

    // ... function logic here ...

    return new Response(JSON.stringify({ result: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // NEVER expose stack traces — return a clean error message only
    console.error(err)
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
```

## auth.ts — requireRole

```typescript
// In _shared/auth.ts
export function requireRole(user: User, minRole: 'member' | 'admin' | 'owner') {
  const hierarchy = { member: 0, admin: 1, owner: 2 }
  const userRole = user.app_metadata?.role as string
  if (hierarchy[userRole] < hierarchy[minRole]) {
    throw new Response(JSON.stringify({ error: 'insufficient_role' }), { status: 403 })
  }
}
```

## Cron-triggered functions (NO JWT auth)

`ingest-signals`, `poll-job-status`, `reset-monthly-quotas`, `archive-old-signals`, `cleanup-apify-signals` are called by pg_cron with the service role key. They do NOT validate a user JWT. They operate across ALL orgs using the service role client directly. Do not apply `requireRole` or user JWT auth in these functions.

## dodopayments-webhook (public, NO JWT)

Verify Dodo Payments HMAC signature as the authentication mechanism. Do not apply any JWT check.

## Supabase clients

```typescript
// Service role (bypasses RLS) — for cron functions, admin ops, Storage writes
const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// User client (respects RLS) — for user-facing reads only
const userClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
)
```

## Encryption (for API keys)

```typescript
// In _shared/encryption.ts
// Always AES-256-GCM. Never store plaintext keys. Never return decrypted keys in responses.
import { encrypt, decrypt } from '../_shared/encryption.ts'

const encryptedKey = await encrypt(plaintextKey, Deno.env.get('ENCRYPTION_KEY')!)
// Store encryptedKey in DB. Decrypt only inside Edge Functions at call time.
```

## Error responses

```typescript
// Always this format — never expose err.message, err.stack, or any internal details
return new Response(JSON.stringify({ error: 'human_readable_description' }), { status: 4xx })
```

## Provider router pattern

```typescript
import { routeGeneration, resolveApiKey } from '../_shared/providers/router.ts'

// resolveApiKey handles: org key → platform env var → HTTP 403 based on key_source
const apiKey = await resolveApiKey(supabase, org_id, provider_key, model.key_source)
const result = await routeGeneration(provider_key, model_id, payload, apiKey)
```

## org_slug lookup (required for OpenRouter traces and filenames)

```typescript
// org_slug is NOT in JWT — query it once per function call, cache in scope
const { data: org } = await supabase.from('orgs').select('slug').eq('id', org_id).single()
const org_slug = org?.slug
```

## Request body validation with Zod (REQUIRED for every mutating Edge Function)

Import the schema from `_shared/schemas.ts` — never define Zod schemas inline in function files.

```typescript
import { z } from 'npm:zod'
import { GenerateAssetBodySchema } from '../_shared/schemas.ts'

// 1. Size guard (spec rule 13: reject bodies > 1 MB)
const contentLength = Number(req.headers.get('content-length') ?? 0)
if (contentLength > 1_048_576) {
  return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers: corsHeaders })
}

// 2. Parse JSON
let rawBody: unknown
try {
  rawBody = await req.json()
} catch {
  return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: corsHeaders })
}

// 3. Validate with Zod — returns typed object or throws ZodError
const parseResult = GenerateAssetBodySchema.safeParse(rawBody)
if (!parseResult.success) {
  return new Response(
    JSON.stringify({ error: 'invalid_request', details: parseResult.error.flatten() }),
    { status: 400, headers: corsHeaders }
  )
}
const body = parseResult.data  // fully typed from here on
```

## `_shared/schemas.ts` — Zod schema reference

All schemas live here. Key exports (add per-function body schemas as needed):

```typescript
import { z } from 'npm:zod'

// ── Shared sub-schemas ──────────────────────────────────────────────────────

export const PromptTagsSchema = z.object({
  subject:          z.string().min(1).max(500),
  visual_style:     z.enum(['photography', 'illustration', 'abstract', '3d', 'flat']),
  mood:             z.string().max(100),
  colour_palette:   z.string().max(200),
  platform:         z.enum(['linkedin', 'instagram', 'twitter', 'generic']),
  aspect_ratio:     z.enum(['1:1', '16:9', '9:16', '4:5']),
  cta_text:         z.string().max(200).optional().default(''),
  negative_prompt:  z.string().max(500).optional().default(''),
  additional_notes: z.string().max(1000).optional().default(''),
})

// ── ContentJob (assembled by build-prompt, stored in generation_jobs) ──────

export const ContentJobSchema = z.object({
  job_id:                 z.string().uuid(),
  org_id:                 z.string().uuid(),
  org_slug:               z.string().min(3).max(30),
  asset_type:             z.enum(['image', 'video']),
  provider_key:           z.enum(['openrouter', 'fal', 'google_ai_studio', 'anthropic', 'openai']),
  model_id:               z.string().min(1).max(200),
  prompt_tags:            PromptTagsSchema,
  brand_context_summary:  z.string().max(5000),
  voice_examples:         z.array(z.string().max(500)).max(3),
  competitor_names:       z.array(z.string().max(100)).max(20),
  signal_headline:        z.string().max(500),
  signal_summary:         z.string().max(2000),
  compiled_prompt:        z.string().min(1).max(8000),
  compiled_negative:      z.string().max(2000),
})

export type ContentJob = z.infer<typeof ContentJobSchema>

// ── JSON Schema versions (for provider structured-output params) ─────────

// Use this with OpenRouter / OpenAI response_format.json_schema.schema
export const ContentJobJsonSchema = zodToJsonSchema(ContentJobSchema, 'ContentJob')

// Use this with Google AI Studio generationConfig.responseSchema
// Gemini uses a subset of JSON Schema — strip 'additionalProperties' and '$schema'
export const ContentJobGeminiSchema = toGeminiSchema(ContentJobSchema)

// ── Per-function request body schemas ──────────────────────────────────────

export const GenerateAssetBodySchema = z.object({
  signal_id:   z.string().uuid(),
  prompt_tags: PromptTagsSchema.partial(),           // user overrides — all optional
  model_id:    z.string().min(1).max(200).optional(), // override default model
})

export const SaveOnboardingBodySchema = z.object({
  company_name:         z.string().min(1).max(200).optional(),
  one_sentence_pitch:   z.string().max(500).optional(),
  extended_description: z.string().max(5000).optional(),
  active_themes:        z.array(z.string().max(100)).max(20).optional(),
  brand_colours:        z.array(z.string().max(20)).max(10).optional(),
  voice_examples:       z.array(z.string().max(500)).max(3).optional(),
  complete:             z.boolean().optional().default(false),
})

export const CreateOrgBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]{3,30}$/, 'slug must be 3–30 chars, lowercase letters, digits, hyphens only'),
})

export const SaveProviderKeyBodySchema = z.object({
  provider_key: z.enum(['openrouter', 'fal', 'google_ai_studio', 'anthropic', 'openai']),
  api_key:      z.string().min(1).max(500),
  key_label:    z.string().max(100).optional(),
})
```

> **Import helpers:** `zodToJsonSchema` from `npm:zod-to-json-schema`, `toGeminiSchema` is a thin wrapper
> that recursively strips `additionalProperties` and renames `const` → `enum` for Gemini compatibility.
> Both helpers should live in `_shared/schemas.ts`.

## LLM JSON response validation (build-prompt / any function expecting JSON from LLM)

```typescript
import { ContentJobSchema } from '../_shared/schemas.ts'

// After getting text response from any provider:
let contentJob: ContentJob
try {
  const raw = JSON.parse(llmResponseText)
  contentJob = ContentJobSchema.parse(raw)   // throws ZodError if shape is wrong
} catch (err) {
  if (err instanceof z.ZodError) {
    // LLM returned bad shape — log for debugging, return 422
    console.error('LLM output failed schema validation', err.flatten())
    return new Response(
      JSON.stringify({ error: 'llm_output_invalid', details: err.flatten() }),
      { status: 422, headers: corsHeaders }
    )
  }
  throw err  // re-throw JSON.parse errors
}
// contentJob is now fully typed and safe to store / pass downstream
```

## Observability (non-OpenRouter providers only)

```typescript
import { recordUsage } from '../_shared/observability.ts'

// Call after every provider API call — on both success and failure
// fire-and-forget: wrapped in try/catch internally, never blocks the response
await recordUsage(supabase, { org_id, org_slug, provider_key, model_id, step_key, job_id,
  key_source_used, prompt_tokens, completion_tokens, total_tokens, latency_ms, success, error_code })
```

## Deploying functions

Use MCP `deploy_edge_function` tool to deploy, or `supabase functions deploy <name>` via CLI.

## operator-admin function — special auth pattern

The `operator-admin` Edge Function does NOT use a user JWT. It authenticates via the `OPERATOR_SECRET` env var. Pattern:

```typescript
// supabase/functions/operator-admin/index.ts
// NO CORS restriction — this endpoint is for operator tooling only (curl, Postman, internal scripts)
// NO requireRole — service role context throughout

const OPERATOR_SECRET = Deno.env.get('OPERATOR_SECRET')

Deno.serve(async (req: Request) => {
  // Auth: check bearer token against OPERATOR_SECRET
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== OPERATOR_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  // Always use service role — bypasses RLS intentionally
  const supabase = createSupabaseClient(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Size guard
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > 1_048_576) {
    return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413 })
  }

  let body: { action: string; payload: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 })
  }

  if (!body.action || typeof body.payload !== 'object') {
    return new Response(JSON.stringify({ error: 'missing action or payload' }), { status: 400 })
  }

  try {
    let result: unknown
    switch (body.action) {
      case 'update_org':       result = await handleUpdateOrg(supabase, body.payload);       break
      case 'reset_org_usage':  result = await handleResetOrgUsage(supabase, body.payload);  break
      case 'delete_member':    result = await handleDeleteMember(supabase, body.payload);   break
      case 'change_member_role': result = await handleChangeMemberRole(supabase, body.payload); break
      case 'toggle_source':    result = await handleToggleSource(supabase, body.payload);   break
      case 'upsert_model':     result = await handleUpsertModel(supabase, body.payload);    break
      case 'create_campaign_job': result = await handleCreateCampaignJob(supabase, body.payload); break
      default:
        return new Response(JSON.stringify({ error: `unknown action: ${body.action}` }), { status: 400 })
    }

    // Audit log — always write, never block
    await supabase.from('operator_audit_log').insert({
      action: body.action,
      target_org_id: body.payload.org_id ?? null,
      target_user_id: body.payload.user_id ?? null,
      payload_summary: JSON.stringify(body.payload).slice(0, 500),
    }).then(() => {}).catch((e: unknown) => console.error('[operator-admin] audit log failed', e))

    return new Response(JSON.stringify({ success: true, result }), { status: 200 })
  } catch (err) {
    console.error('[operator-admin] action failed', err)
    return new Response(JSON.stringify({ error: 'action_failed' }), { status: 500 })
  }
})
```

Key rules for `operator-admin`:
- **Never use a user JWT** — authentication is purely via `OPERATOR_SECRET` bearer token comparison
- **Always use service role client** — all DB operations bypass RLS intentionally
- **No CORS headers** — this function is not called from the browser
- **Write audit log after every action** — fire-and-forget, never block on failure
- **Never expose stack traces** — `{ error: 'action_failed' }` only, log internally
- **Quota still applies for create_campaign_job** — deduct from org's `image_used`/`video_used`
- **OPERATOR_SECRET must be non-empty** — fail closed if env var is missing: `if (!OPERATOR_SECRET) return new Response(JSON.stringify({error:'misconfigured'}), {status:500})`
