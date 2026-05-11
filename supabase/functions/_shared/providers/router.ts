import { createServiceClient } from '../db.ts'
import { decrypt } from '../encryption.ts'

export interface ProviderResponse {
  text?: string
  imageUrl?: string
  videoUrl?: string
  bytes?: Uint8Array
  outputUrl?: string
  jobId?: string
  status?: string
}

/**
 * Typed provider error so callers can map to user-facing messages
 * and decide whether to refund quota.
 *
 *  code              meaning                                   refund quota?
 *  ---------------------------------------------------------------------------
 *  rate_limit        provider returned 429 after all retries   YES
 *  overloaded        provider returned 5xx after all retries   YES
 *  timeout           our AbortController fired                 YES
 *  network           connection failure                         YES
 *  auth_failed       401/403 from provider (bad key)           YES
 *  invalid_request   400 — usually our prompt is malformed     NO (our bug)
 *  invalid_response  provider returned 200 but no usable data  YES
 *  unknown           fallthrough                                YES
 */
export class ProviderError extends Error {
  code: 'rate_limit' | 'overloaded' | 'timeout' | 'network' | 'auth_failed' | 'invalid_request' | 'invalid_response' | 'unknown'
  status: number
  provider: string
  retryable: boolean

  constructor(opts: {
    code: ProviderError['code']
    message: string
    status?: number
    provider?: string
    retryable?: boolean
  }) {
    super(opts.message)
    this.name = 'ProviderError'
    this.code = opts.code
    this.status = opts.status ?? 0
    this.provider = opts.provider ?? 'unknown'
    this.retryable = opts.retryable ?? (opts.code === 'rate_limit' || opts.code === 'overloaded' || opts.code === 'timeout' || opts.code === 'network')
  }
}

/**
 * Map a ProviderError to a clean user-facing message.
 * Used by Edge Functions when returning the error JSON to the client.
 */
export function userMessageFor(err: ProviderError | Error): { error: string; retryable: boolean; code: string } {
  if (err instanceof ProviderError) {
    const map: Record<ProviderError['code'], string> = {
      rate_limit:       `${err.provider} is busy right now (rate limited). Your quota was not deducted — please try again in a moment.`,
      overloaded:       `${err.provider} is temporarily overloaded. Your quota was not deducted — please try again shortly.`,
      timeout:          `${err.provider} is taking longer than usual. Your quota was not deducted — please try again.`,
      network:          `Could not reach ${err.provider}. Your quota was not deducted — please check your connection and retry.`,
      auth_failed:      `${err.provider} rejected the API key. Check your key in Settings → Model Settings.`,
      invalid_request:  `The request to ${err.provider} was invalid. Please contact support if this keeps happening.`,
      invalid_response: `${err.provider} returned an unexpected response. Your quota was not deducted — please try again.`,
      unknown:          `${err.provider} returned an unexpected error. Your quota was not deducted — please try again.`,
    }
    return { error: map[err.code], retryable: err.retryable, code: err.code }
  }
  return { error: 'An unexpected error occurred. Your quota was not deducted — please try again.', retryable: true, code: 'unknown' }
}

/**
 * Hardened fetch with timeout + exponential-backoff retry.
 * Use this from EVERY provider adapter instead of bare fetch().
 *
 * - Timeout:  configurable (default 60s for text, 120s for images)
 * - Retries:  3 attempts total on 408/429/500/502/503/504/network errors
 * - Backoff:  exponential (1s, 2s, 4s) with jitter
 * - On non-retryable 4xx: throws ProviderError immediately
 * - Honours Retry-After header on 429 if present
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number; provider?: string; maxAttempts?: number } = {},
): Promise<Response> {
  const { timeoutMs = 60_000, provider = 'AI provider', maxAttempts = 3, ...fetchInit } = init
  const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...fetchInit, signal: controller.signal })
      clearTimeout(timer)

      if (res.ok) return res

      // Non-retryable client errors — throw immediately
      if (res.status === 401 || res.status === 403) {
        throw new ProviderError({ code: 'auth_failed', message: `${provider} auth failed (${res.status})`, status: res.status, provider, retryable: false })
      }
      if (res.status === 400 || res.status === 404 || res.status === 422) {
        const body = await res.text().catch(() => '')
        throw new ProviderError({ code: 'invalid_request', message: `${provider} rejected request (${res.status}): ${body.slice(0, 200)}`, status: res.status, provider, retryable: false })
      }

      // Retryable
      if (RETRY_STATUS.has(res.status) && attempt < maxAttempts) {
        const retryAfter = res.headers.get('retry-after')
        const explicit = retryAfter ? parseInt(retryAfter, 10) * 1000 : 0
        const backoff = explicit || Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 250)
        await new Promise(r => setTimeout(r, backoff))
        continue
      }

      // Out of retries on a retryable status — bubble as overloaded/rate_limit
      const code = res.status === 429 ? 'rate_limit' : 'overloaded'
      throw new ProviderError({ code, message: `${provider} ${res.status} after ${attempt} attempt(s)`, status: res.status, provider })
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof ProviderError && !err.retryable) throw err
      if (err instanceof ProviderError && attempt >= maxAttempts) throw err

      // AbortError = our timeout
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (attempt >= maxAttempts) {
          throw new ProviderError({ code: 'timeout', message: `${provider} timeout after ${timeoutMs}ms × ${attempt} attempt(s)`, provider })
        }
      } else if (err instanceof TypeError) {
        // Network error (DNS, refused, broken pipe)
        if (attempt >= maxAttempts) {
          throw new ProviderError({ code: 'network', message: `${provider} network error: ${err.message}`, provider })
        }
      } else if (err instanceof ProviderError) {
        // Already typed & retryable — fall through to backoff
      } else {
        if (attempt >= maxAttempts) throw err
      }
      lastErr = err as Error

      const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 250)
      await new Promise(r => setTimeout(r, backoff))
    }
  }
  throw lastErr ?? new ProviderError({ code: 'unknown', message: `${provider} failed after retries`, provider })
}

/**
 * Resolves the API key for a provider for a given org.
 * Reads byok_mode from orgs table, then:
 * - byok_mode=true: always require org key (no platform fallback)
 * - byok_mode=false: use org key > platform env var per key_source
 */
export async function resolveApiKey(
  orgId: string,
  providerKey: string,
  modelKeySource: string = 'user_or_platform',
): Promise<string> {
  const supabase = createServiceClient()

  // Check org byok_mode
  const { data: org } = await supabase
    .from('orgs')
    .select('byok_mode, plan_tier')
    .eq('id', orgId)
    .single()

  const byokMode = org?.byok_mode ?? false

  // Check for org's own key
  const { data: keyRow } = await supabase
    .from('org_provider_api_keys')
    .select('encrypted_key')
    .eq('org_id', orgId)
    .eq('provider_key', providerKey)
    .single()

  if (keyRow?.encrypted_key) {
    return await decrypt(keyRow.encrypted_key)
  }

  // BYOK mode: no platform fallback
  if (byokMode) {
    const providerNames: Record<string, string> = {
      openrouter: 'OpenRouter',
      fal: 'fal.ai',
      google_ai_studio: 'Google AI Studio',
      anthropic: 'Anthropic',
      openai: 'OpenAI',
    }
    throw new Response(
      JSON.stringify({
        error: `BYOK plan requires your own ${providerNames[providerKey] ?? providerKey} API key. Add it in Settings → Model Settings.`,
      }),
      { status: 403 },
    )
  }

  // Platform key fallback based on key_source
  if (modelKeySource === 'user_required') {
    const providerNames: Record<string, string> = {
      openrouter: 'OpenRouter',
      fal: 'fal.ai',
      google_ai_studio: 'Google AI Studio',
      anthropic: 'Anthropic',
      openai: 'OpenAI',
    }
    throw new Response(
      JSON.stringify({
        error: `This model requires your own ${providerNames[providerKey] ?? providerKey} API key. Add it in Settings → Model Settings.`,
      }),
      { status: 403 },
    )
  }

  // user_or_platform or platform: use platform env var
  const platformKeys: Record<string, string> = {
    openrouter: 'OPENROUTER_DEFAULT_API_KEY',
    fal: 'FAL_API_KEY',
    google_ai_studio: 'GOOGLE_AI_STUDIO_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
  }

  const envVar = platformKeys[providerKey]
  const platformKey = envVar ? Deno.env.get(envVar) : undefined

  if (platformKey) return platformKey

  throw new Response(
    JSON.stringify({
      error: `No API key found for ${providerKey}. Add your key in Settings → Model Settings, or switch to a different provider.`,
    }),
    { status: 403 },
  )
}

/**
 * routeVideoGeneration — routes a video generation request to the correct provider.
 * All video models are async — always returns { jobId/request_id, status: 'pending' }.
 */
export async function routeVideoGeneration(
  providerKey: string,
  modelId: string,
  payload: any,
  apiKey: string,
): Promise<{ request_id?: string; operationName?: string; videoUrl?: string; status: string }> {
  const prompt = payload.compiled_prompt ?? payload.prompt ?? ''
  const negativePrompt = payload.compiled_negative ?? payload.negative_prompt ?? ''
  const orgId = payload.org_id as string
  const orgSlug = payload.org_slug as string
  const jobId = payload.job_id as string

  switch (providerKey) {
    case 'fal': {
      const { callFalVideo } = await import('./fal.ts')
      const result = await callFalVideo(modelId, {
        compiled_prompt: prompt,
        compiled_negative: negativePrompt,
        aspect_ratio: payload.prompt_tags?.aspect_ratio ?? payload.aspect_ratio,
      }, apiKey)
      return { request_id: result.request_id, status: 'pending' }
    }
    case 'google_ai_studio': {
      const { callGoogleAIStudioVideo } = await import('./google_ai_studio.ts')
      const aspectRatio = payload.prompt_tags?.aspect_ratio ?? payload.aspect_ratio ?? '9:16'
      const duration = (payload.video_duration ?? 8) as number
      const result = await callGoogleAIStudioVideo(modelId, prompt, negativePrompt, apiKey, aspectRatio, duration)
      return { operationName: result.operationName, status: 'pending' }
    }
    case 'openrouter': {
      const { callOpenRouterVideo } = await import('./openrouter.ts')
      return await callOpenRouterVideo(modelId, prompt, negativePrompt, apiKey, orgId, orgSlug, jobId)
    }
    default:
      throw new Response(
        JSON.stringify({ error: `Video not supported on provider: ${providerKey}` }),
        { status: 400 },
      )
  }
}

/**
 * routeTextGeneration — dispatches text/chat prompts to the correct provider.
 * Used by personalise, generate-campaign-brief, build-prompt, and any other
 * step that needs a text completion.
 */
export async function routeTextGeneration(
  providerKey: string,
  modelId: string,
  messages: { role: string; content: string }[],
  apiKey: string,
  orgId: string,
  orgSlug: string,
  jobId: string | null,
  stepKey: string,
  opts: { responseFormat?: any; maxTokens?: number } = {},
): Promise<string> {
  switch (providerKey) {
    case 'openrouter': {
      const { callOpenRouter } = await import('./openrouter.ts')
      // callOpenRouter takes (modelId, prompt, opts, apiKey, orgSlug, orgId, jobId, stepKey)
      // For multi-message we concatenate system + user
      const systemMsg = messages.find(m => m.role === 'system')?.content
      const userMsg = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n\n')
      return await callOpenRouter(
        modelId,
        userMsg,
        { systemPrompt: systemMsg, responseFormat: opts.responseFormat, maxTokens: opts.maxTokens },
        apiKey,
        orgSlug,
        orgId,
        jobId ?? undefined,
        stepKey,
      )
    }
    case 'anthropic': {
      const { callAnthropic } = await import('./anthropic.ts')
      const result = await callAnthropic(modelId, messages, apiKey, {
        org_id: orgId, job_id: jobId ?? undefined, step_key: stepKey,
        key_source_used: 'platform',
      })
      return result.text
    }
    case 'openai': {
      const { callOpenAI } = await import('./openai.ts')
      const result = await callOpenAI(modelId, messages, apiKey, {
        org_id: orgId, job_id: jobId ?? undefined, step_key: stepKey,
        key_source_used: 'platform',
      })
      return result.text
    }
    case 'google_ai_studio': {
      const { callGoogleAIStudio } = await import('./google_ai_studio.ts')
      const userContent = messages.map(m => m.content).join('\n\n')
      const result = await callGoogleAIStudio(modelId, { compiled_prompt: userContent, org_id: orgId }, apiKey)
      return result.text ?? ''
    }
    default:
      throw new Response(
        JSON.stringify({ error: `Text generation not supported on provider: ${providerKey}` }),
        { status: 400 },
      )
  }
}

/**
 * Routes a generation request to the correct provider adapter.
 */
export async function routeGeneration(
  providerKey: string,
  modelId: string,
  payload: any,
  apiKey: string,
): Promise<ProviderResponse> {
  switch (providerKey) {
    case 'openrouter': {
      const { callOpenRouterImage, callOpenRouter } = await import('./openrouter.ts')
      if (payload.asset_type === 'image') {
        return await callOpenRouterImage(
          modelId,
          payload.compiled_prompt,
          payload.image_config,
          payload.modalities,
          apiKey,
          payload.org_slug,
          payload.org_id,
          payload.job_id,
          payload.reference_image_url,
        )
      }
      const text = await callOpenRouter(modelId, payload.prompt, {}, apiKey, payload.org_slug)
      return { text }
    }
    case 'fal': {
      const { callFal } = await import('./fal.ts')
      return await callFal(modelId, payload, apiKey)
    }
    case 'google_ai_studio': {
      const { callGoogleAIStudio } = await import('./google_ai_studio.ts')
      return await callGoogleAIStudio(modelId, payload, apiKey)
    }
    case 'anthropic': {
      const { callAnthropic } = await import('./anthropic.ts')
      return await callAnthropic(modelId, payload.messages, apiKey)
    }
    case 'openai': {
      const { callOpenAI } = await import('./openai.ts')
      return await callOpenAI(modelId, payload.messages, apiKey)
    }
    default:
      throw new Response(
        JSON.stringify({ error: `Unknown provider: ${providerKey}` }),
        { status: 400 },
      )
  }
}
