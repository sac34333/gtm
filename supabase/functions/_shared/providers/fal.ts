import { createServiceClient } from '../db.ts'
import { recordUsage } from '../observability.ts'

import { fetchWithRetry } from './router.ts'

const FAL_BASE = 'https://queue.fal.run'

// Maps ContentJob aspect_ratio to fal model-specific params
function buildFalInput(modelId: string, payload: any): Record<string, any> {
  const prompt = payload.compiled_prompt as string
  const compiledNegative = payload.compiled_negative as string
  const aspectRatio = payload.prompt_tags?.aspect_ratio ?? '1:1'

  // image_size named enum mapping (for Seedream, Qwen)
  const imageSizeMap: Record<string, string> = {
    '1:1': 'square_hd',
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_16_9',
    '4:5': 'portrait_4_3',
  }

  if (modelId === 'fal-ai/nano-banana-2') {
    return {
      prompt,
      aspect_ratio: aspectRatio === '4:5' ? '4:5' : aspectRatio,
      resolution: '1K',
      num_images: 1,
      output_format: 'png',
      negative_prompt: compiledNegative ? `\n\nNegative: ${compiledNegative}` : undefined,
    }
  }

  if (modelId === 'fal-ai/nano-banana') {
    return {
      prompt: compiledNegative ? `${prompt}\n\nNegative: ${compiledNegative}` : prompt,
      aspect_ratio: aspectRatio,
      num_images: 1,
      output_format: 'png',
    }
  }

  if (modelId === 'fal-ai/bytedance/seedream/v4/text-to-image') {
    return {
      prompt: compiledNegative ? `${prompt}\n\nNegative: ${compiledNegative}` : prompt,
      image_size: imageSizeMap[aspectRatio] ?? 'square_hd',
      num_images: 1,
      enhance_prompt_mode: 'auto',
    }
  }

  if (modelId === 'fal-ai/qwen-image') {
    return {
      prompt,
      image_size: imageSizeMap[aspectRatio] ?? 'square_hd',
      num_images: 1,
      negative_prompt: compiledNegative || undefined,
      output_format: 'png',
      use_turbo: true,
    }
  }

  if (modelId === 'fal-ai/gemini-3.1-flash-image-preview') {
    const systemPrompt = payload.brand_context_summary as string | undefined
    const ctaText = payload.prompt_tags?.cta_text as string | undefined
    return {
      prompt,
      system_prompt: systemPrompt || undefined,
      aspect_ratio: aspectRatio === '4:5' ? '4:5' : aspectRatio,
      output_format: 'png',
      safety_tolerance: '4',
      sync_mode: true,
      limit_generations: true,
      resolution: '1K',
    }
  }

  if (modelId === 'fal-ai/flux-2-pro') {
    return {
      prompt,
      image_size: imageSizeMap[aspectRatio] ?? 'landscape_4_3',
      output_format: 'png',
      safety_tolerance: '2',
      sync_mode: true,
    }
  }

  if (modelId === 'fal-ai/flux-pro/kontext/max/text-to-image') {
    return {
      prompt: compiledNegative ? `${prompt}\n\nNegative: ${compiledNegative}` : prompt,
      aspect_ratio: aspectRatio,
      guidance_scale: 3.5,
      num_images: 1,
      output_format: 'png',
      enhance_prompt: true,
    }
  }

  // Default / video models
  return {
    prompt: compiledNegative ? `${prompt}\n\nNegative: ${compiledNegative}` : prompt,
    aspect_ratio: aspectRatio,
  }
}

/**
 * submitFalImage — submits an image generation job to fal.ai queue WITHOUT waiting.
 * Returns immediately with { request_id, status: 'pending' } so the Edge Function
 * can return status 200 before Supabase's execution time limit is hit.
 * poll-job-status will poll for the result later.
 */
export async function submitFalImage(
  modelId: string,
  payload: any,
  apiKey: string,
): Promise<{ request_id: string; status: string }> {
  const orgId = payload.org_id as string
  const jobId = payload.job_id as string
  const start = Date.now()

  const input = buildFalInput(modelId, payload)

  const submitRes = await fetchWithRetry(`${FAL_BASE}/${modelId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
    timeoutMs: 30_000,
    provider: 'fal.ai',
  })

  if (!submitRes.ok) {
    const errText = await submitRes.text()
    await recordUsage(createServiceClient(), {
      org_id: orgId, provider_key: 'fal', model_id: modelId,
      step_key: payload.step_key, job_id: jobId,
      key_source_used: payload.key_source_used ?? 'platform',
      latency_ms: Date.now() - start, success: false,
      error_code: `fal_${submitRes.status}`,
    })
    throw new Error(`fal submit error ${submitRes.status}: ${errText}`)
  }

  const submitData = await submitRes.json()
  const requestId = submitData.request_id as string
  if (!requestId) throw new Error('fal_no_request_id')

  return { request_id: requestId, status: 'pending' }
}

/**
 * callFal — submits a job to fal.ai.
 * For models with sync_mode=true (e.g. FLUX.2 Pro), uses the synchronous
 * fal.run endpoint and returns the result immediately.
 * For other models, uses the queue.fal.run endpoint and polls for the result.
 * Downloads the image and uploads to Supabase Storage.
 */
export async function callFal(
  modelId: string,
  payload: any,
  apiKey: string,
): Promise<{ bytes: Uint8Array; outputUrl: string }> {
  const orgId = payload.org_id as string
  const jobId = payload.job_id as string
  const start = Date.now()

  const input = buildFalInput(modelId, payload)
  const isSync = input.sync_mode === true

  // Sync models use fal.run, async models use queue.fal.run
  const baseUrl = isSync ? 'https://fal.run' : FAL_BASE

  const submitRes = await fetchWithRetry(`${baseUrl}/${modelId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(isSync ? input : { input }),
    timeoutMs: isSync ? 120_000 : 30_000,
    provider: isSync ? 'fal.ai (sync)' : 'fal.ai',
  })

  if (!submitRes.ok) {
    const errText = await submitRes.text()
    await recordUsage(createServiceClient(), {
      org_id: orgId, provider_key: 'fal', model_id: modelId,
      step_key: payload.step_key, job_id: jobId,
      key_source_used: payload.key_source_used ?? 'user',
      latency_ms: Date.now() - start, success: false,
      error_code: `fal_${submitRes.status}`,
    })
    throw new Error(`fal submit error ${submitRes.status}: ${errText}`)
  }

  const data = await submitRes.json()
  const latency = Date.now() - start

  // For sync mode, the result is in the response directly
  // For async mode, poll for the result
  let imageUrl: string | undefined

  if (isSync) {
    // Sync response: { images: [{ url: '...' }], seed: number }
    imageUrl = data?.images?.[0]?.url
  } else {
    // Queue response: { request_id: '...' }
    const requestId = data.request_id as string
    if (!requestId) throw new Error('fal_no_request_id')
    const result = await pollFalJobSync(requestId, apiKey, modelId)
    imageUrl = result?.images?.[0]?.url
  }

  if (!imageUrl) {
    await recordUsage(createServiceClient(), {
      org_id: orgId, provider_key: 'fal', model_id: modelId,
      step_key: payload.step_key, job_id: jobId,
      key_source_used: payload.key_source_used ?? 'user',
      latency_ms: latency, success: false, error_code: 'fal_no_image_url',
    })
    throw new Error('fal_no_image_url')
  }

  // Fetch image bytes from ephemeral fal URL
  const imgRes = await fetch(imageUrl)
  const bytes = new Uint8Array(await imgRes.arrayBuffer())

  // Upload to Supabase Storage
  const supabase = createServiceClient()
  const ext = payload.asset_type === 'video' ? 'mp4' : 'png'
  const storagePath = `${orgId}/${jobId}.${ext}`
  const contentType = ext === 'mp4' ? 'video/mp4' : 'image/png'

  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(storagePath, bytes, { contentType, upsert: true })

  if (uploadError) throw new Error(`fal storage upload failed: ${uploadError.message}`)

  const { data: signedData } = await supabase.storage
    .from('assets')
    .createSignedUrl(storagePath, 3600)

  await recordUsage(createServiceClient(), {
    org_id: orgId, provider_key: 'fal', model_id: modelId,
    step_key: payload.step_key, job_id: jobId,
    key_source_used: payload.key_source_used ?? 'user',
    latency_ms: latency, success: true,
  })

  return { bytes, outputUrl: signedData?.signedUrl ?? storagePath }
}

/**
 * pollFalJobSync — polls a fal.ai queue job until completion.
 * Used for async image models (not FLUX.2 Pro which uses sync_mode).
 */
async function pollFalJobSync(
  requestId: string,
  apiKey: string,
  modelId: string,
): Promise<any> {
  const maxAttempts = 60
  let attempts = 0

  while (attempts < maxAttempts) {
    attempts++
    await new Promise(r => setTimeout(r, 5000))

    const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}/status`, {
      headers: { 'Authorization': `Key ${apiKey}` },
    })

    if (!statusRes.ok) continue
    const status = await statusRes.json()

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${apiKey}` },
      })
      if (!resultRes.ok) throw new Error('fal_result_fetch_failed')
      return await resultRes.json()
    }

    if (status.status === 'FAILED') {
      throw new Error(`fal_job_failed: ${status.error ?? 'unknown'}`)
    }
  }

  throw new Error('fal_poll_timeout')
}

/**
 * callFalVideo — submits an async video job to fal.ai queue.
 * Supports both Veo 3.1 and Seedance 2.0 (text-to-video and image-to-video variants).
 * Always returns immediately with request_id (video is always async).
 */
export async function callFalVideo(
  modelId: string,
  payload: {
    compiled_prompt: string
    compiled_negative?: string
    aspect_ratio?: string
    /** Duration string — Veo format: "4s"|"6s"|"8s"; Seedance format: "auto"|"4"…"15" */
    duration?: string
    /** Resolution: "480p"|"720p"|"1080p"|"4k" */
    resolution?: string
    generate_audio?: boolean
    /** Signed URL of the source image (image-to-video) */
    image_url?: string
    /** Optional end-frame image URL (Seedance i2v only) */
    end_image_url?: string
  },
  apiKey: string,
): Promise<{ request_id: string; status: string }> {
  const isI2V = modelId.includes('image-to-video')
  const isVeo = modelId.includes('veo')

  const input: Record<string, any> = {
    prompt: payload.compiled_prompt,
  }

  // Aspect ratio
  if (payload.aspect_ratio) input.aspect_ratio = payload.aspect_ratio

  // Duration — pass only if explicitly set (skip "auto" for Veo; Seedance accepts "auto")
  if (payload.duration && payload.duration !== '') {
    if (payload.duration !== 'auto' || !isVeo) {
      input.duration = payload.duration
    }
  }

  // Resolution
  if (payload.resolution) input.resolution = payload.resolution

  // Audio generation (both models support it)
  if (payload.generate_audio !== undefined) input.generate_audio = payload.generate_audio

  // Negative prompt — Veo only (Seedance schema doesn't include it).
  // Per Veo docs: use noun/adjective form ("wall, frame") NOT instructive ("no walls", "don't show").
  // Sanitize to strip common instructive prefixes from each comma-separated token.
  if (isVeo && payload.compiled_negative) {
    const sanitized = payload.compiled_negative
      .split(',')
      .map(token => token.trim().replace(/^(no |don't |dont |avoid |without |exclude |remove )/i, '').trim())
      .filter(Boolean)
      .join(', ')
    if (sanitized) input.negative_prompt = sanitized
  }

  // Source image — required for all i2v endpoints
  if (isI2V && payload.image_url) input.image_url = payload.image_url

  // End-frame image — Seedance i2v only
  if (isI2V && !isVeo && payload.end_image_url) input.end_image_url = payload.end_image_url

  const submitRes = await fetchWithRetry(`${FAL_BASE}/${modelId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
    timeoutMs: 30_000,
    provider: 'fal.ai Video',
  })

  if (!submitRes.ok) {
    const errText = await submitRes.text()
    throw new Error(`fal video submit error ${submitRes.status}: ${errText}`)
  }

  const data = await submitRes.json()
  const request_id = data.request_id as string
  if (!request_id) throw new Error('fal_video_no_request_id')

  return { request_id, status: 'pending' }
}

/**
 * pollFalVideoJob — checks fal.ai video job status.
 * Returns completed with videoUrl, processing, or failed.
 */
export async function pollFalVideoJob(
  modelId: string,
  requestId: string,
  apiKey: string,
): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}/status`, {
    headers: { 'Authorization': `Key ${apiKey}` },
  })

  if (!statusRes.ok) return { status: 'processing' }
  const statusData = await statusRes.json()

  if (statusData.status === 'COMPLETED') {
    const resultRes = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}`, {
      headers: { 'Authorization': `Key ${apiKey}` },
    })
    if (!resultRes.ok) return { status: 'processing' }
    const result = await resultRes.json()
    const videoUrl = result.video?.url ?? result.videos?.[0]?.url
    if (!videoUrl) return { status: 'failed', error: 'fal_video_no_url' }
    return { status: 'completed', videoUrl }
  }

  if (statusData.status === 'FAILED') {
    return { status: 'failed', error: statusData.error ?? 'fal_video_failed' }
  }

  return { status: 'processing' }
}

/**
 * pollFalJob — performs a SINGLE status check for a fal.ai image job.
 * Returns { status, imageUrl? } for poll-job-status to process each cron tick.
 * Uses model-specific endpoints: /{modelId}/requests/{requestId}
 */
export async function pollFalJob(
  requestId: string,
  apiKey: string,
  modelId: string = 'fal-ai/flux-2-pro',
): Promise<{ status: string; imageUrl?: string; error?: string }> {
  try {
    const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}/status`, {
      headers: { 'Authorization': `Key ${apiKey}` },
    })

    if (!statusRes.ok) return { status: 'processing' }
    const statusData = await statusRes.json()

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${apiKey}` },
      })
      if (!resultRes.ok) return { status: 'processing' }
      const result = await resultRes.json()
      const imageUrl = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url
      if (!imageUrl) return { status: 'failed', error: 'fal_no_image_url' }
      return { status: 'completed', imageUrl }
    }

    if (statusData.status === 'FAILED') {
      return { status: 'failed', error: statusData.error ?? 'fal_job_failed' }
    }

    return { status: 'processing' }
} catch (err: any) {
    return { status: 'processing' }
  }
}
