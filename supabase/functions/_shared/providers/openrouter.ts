import { createServiceClient } from '../db.ts'
import { recordUsage } from '../observability.ts'
import { fetchWithRetry } from './router.ts'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

/**
 * callOpenRouter — text generation (prompt_assembly, relevance_scoring, outreach_copy, campaign_brief, brand_embedding).
 * Returns the response text from choices[0].message.content.
 * Includes OpenRouter Broadcast tags for Langfuse per-client filtering.
 */
export async function callOpenRouter(
  modelId: string,
  prompt: string,
  opts: {
    systemPrompt?: string
    responseFormat?: any
    maxTokens?: number
    keySourceUsed?: 'platform' | 'user'
  },
  apiKey: string,
  orgSlug: string,
  orgId?: string,
  jobId?: string,
  stepKey?: string,
): Promise<string> {
  const start = Date.now()
  const messages = []
  if (opts.systemPrompt) {
    messages.push({ role: 'system', content: opts.systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  const body: any = {
    model: modelId,
    messages,
    max_tokens: opts.maxTokens ?? 4096,
    user: orgId,
    session_id: jobId,
    trace: {
      org_id: orgId,
      org_slug: orgSlug,
      step_key: stepKey,
      job_id: jobId ?? null,
    },
  }

  if (opts.responseFormat) {
    body.response_format = opts.responseFormat
  }

  const res = await fetchWithRetry(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gtmengine.qubitlyventures.com',
      'X-Title': 'GTM Engine',
    },
    body: JSON.stringify(body),
    timeoutMs: 60_000,
    provider: 'OpenRouter',
  })

  if (!res.ok) {
    const errText = await res.text()
    if (orgId) {
      await recordUsage(createServiceClient(), {
        org_id: orgId, provider_key: 'openrouter', model_id: modelId,
        step_key: stepKey, job_id: jobId,
        key_source_used: opts.keySourceUsed ?? 'platform',
        latency_ms: Date.now() - start, success: false,
        error_code: `openrouter_${res.status}`,
      })
    }
    throw new Error(`OpenRouter error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('openrouter_no_output')

  if (orgId) {
    await recordUsage(createServiceClient(), {
      org_id: orgId, provider_key: 'openrouter', model_id: modelId,
      step_key: stepKey, job_id: jobId,
      key_source_used: opts.keySourceUsed ?? 'platform',
      prompt_tokens: data.usage?.prompt_tokens,
      completion_tokens: data.usage?.completion_tokens,
      total_tokens: data.usage?.total_tokens,
      latency_ms: Date.now() - start, success: true,
    })
  }

  return content
}

/**
 * callOpenRouterImage — image generation ONLY.
 * Parses from choices[0].message.images[0].image_url.url (base64 data URL).
 * Uploads to Supabase Storage and returns { bytes, outputUrl }.
 */
export async function callOpenRouterImage(
  modelId: string,
  compiledPrompt: string,
  imageConfig: { aspect_ratio?: string; image_size?: string } | undefined,
  modalities: string[] | undefined,
  apiKey: string,
  orgSlug: string,
  orgId: string,
  jobId: string,
  referenceImageUrl?: string,
): Promise<{ bytes: Uint8Array; outputUrl: string }> {
  const start = Date.now()
  // If a reference image is supplied, use multimodal message format so the
  // model can EDIT the existing image instead of generating from scratch.
  const userContent: any = referenceImageUrl
    ? [
        { type: 'text', text: compiledPrompt },
        { type: 'image_url', image_url: { url: referenceImageUrl } },
      ]
    : compiledPrompt

  const body: any = {
    model: modelId,
    messages: [{ role: 'user', content: userContent }],
    user: orgId,
    session_id: jobId,
    trace: {
      org_id: orgId,
      org_slug: orgSlug,
      step_key: 'image_generation',
      job_id: jobId,
      mode: referenceImageUrl ? 'edit' : 'generate',
    },
  }

  if (modalities) {
    body.modalities = modalities
  }

  if (imageConfig?.aspect_ratio || imageConfig?.image_size) {
    body.image_config = {
      ...(imageConfig.aspect_ratio ? { aspect_ratio: imageConfig.aspect_ratio } : {}),
      ...(imageConfig.image_size ? { image_size: imageConfig.image_size } : {}),
    }
  }

  const res = await fetchWithRetry(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gtmengine.qubitlyventures.com',
      'X-Title': 'GTM Engine',
    },
    body: JSON.stringify(body),
    timeoutMs: 120_000,
    provider: 'OpenRouter Images',
  })

  if (!res.ok) {
    const errText = await res.text()
    await recordUsage(createServiceClient(), {
      org_id: orgId, provider_key: 'openrouter', model_id: modelId,
      step_key: 'image_generation', job_id: jobId,
      key_source_used: 'platform',
      latency_ms: Date.now() - start, success: false,
      error_code: `openrouter_image_${res.status}`,
    })
    throw new Error(`OpenRouter image error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const images = data.choices?.[0]?.message?.images
  if (!images?.length) throw new Error('openrouter_image_no_output')

  const imageUrl: string = images[0].image_url?.url ?? images[0].url
  if (!imageUrl) throw new Error('openrouter_image_no_output')

  await recordUsage(createServiceClient(), {
    org_id: orgId, provider_key: 'openrouter', model_id: modelId,
    step_key: 'image_generation', job_id: jobId,
    key_source_used: 'platform',
    prompt_tokens: data.usage?.prompt_tokens,
    completion_tokens: data.usage?.completion_tokens,
    total_tokens: data.usage?.total_tokens,
    latency_ms: Date.now() - start, success: true,
  })

  // Decode base64 data URL
  let bytes: Uint8Array
  if (imageUrl.startsWith('data:')) {
    const base64 = imageUrl.split(',')[1]
    bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  } else {
    // Direct URL — fetch it
    const imgRes = await fetch(imageUrl)
    bytes = new Uint8Array(await imgRes.arrayBuffer())
  }

  // Upload to Supabase Storage
  const supabase = createServiceClient()
  const storagePath = `${orgId}/${jobId}.png`
  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(storagePath, bytes, { contentType: 'image/png', upsert: true })

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

  const { data: signedData } = await supabase.storage
    .from('assets')
    .createSignedUrl(storagePath, 3600)

  return { bytes, outputUrl: signedData?.signedUrl ?? storagePath }
}

/**
 * callOpenRouterVideo — submits an async video generation job via OpenRouter.
 * Uses /api/v1/images/generations. Returns request_id for polling.
 */
export async function callOpenRouterVideo(
  modelId: string,
  prompt: string,
  negativePrompt: string,
  apiKey: string,
  orgId: string,
  orgSlug: string,
  jobId: string,
): Promise<{ request_id?: string; videoUrl?: string; status: string }> {
  const body: any = {
    model: modelId,
    prompt,
    user: orgId,
    session_id: jobId,
    trace: { org_id: orgId, org_slug: orgSlug, step_key: 'video_generation', job_id: jobId },
  }
  if (negativePrompt) body.negative_prompt = negativePrompt

  const res = await fetchWithRetry(`${OPENROUTER_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gtmengine.qubitlyventures.com',
      'X-Title': 'GTM Engine',
    },
    body: JSON.stringify(body),
    timeoutMs: 60_000,
    provider: 'OpenRouter Video',
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenRouter video error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const videoUrl = data.data?.[0]?.url
  if (videoUrl) return { videoUrl, status: 'completed' }
  return { request_id: data.id, status: 'pending' }
}

/**
 * pollOpenRouterJob — polls async video jobs only.
 */
export async function pollOpenRouterJob(
  jobId: string,
  apiKey: string,
): Promise<{ status: string; outputUrl?: string }> {
  const res = await fetch(`${OPENROUTER_BASE}/generation?id=${jobId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`OpenRouter poll error ${res.status}`)
  const data = await res.json()
  return {
    status: data.status ?? 'pending',
    outputUrl: data.output_url,
  }
}

/**
 * fetchOpenRouterModelList — fetches all live models from OpenRouter.
 * Filter by output_modalities client-side for image-capable models.
 */
export async function fetchOpenRouterModelList(apiKey: string): Promise<any[]> {
  const res = await fetch(`${OPENROUTER_BASE}/models`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.data ?? []
}
