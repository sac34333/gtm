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
      const result = await callGoogleAIStudioVideo(modelId, prompt, negativePrompt, apiKey)
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
