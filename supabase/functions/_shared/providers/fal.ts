import { createServiceClient } from '../db.ts'
import { recordUsage } from '../observability.ts'

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
 * callFal — submits a job to fal.ai and waits for the result.
 * Downloads the result URL and uploads to Supabase Storage.
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

  // Submit to fal queue
  const submitRes = await fetch(`${FAL_BASE}/${modelId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
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

  const submitData = await submitRes.json()
  const requestId = submitData.request_id as string
  if (!requestId) throw new Error('fal_no_request_id')

  // Poll for result
  const result = await pollFalJob(requestId, apiKey)
  const latency = Date.now() - start

  // Get image URL from result
  const imageUrl = result?.data?.images?.[0]?.url
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
 * callFalVideo — submits an async video job to fal.ai queue.
 * Always returns immediately with request_id (video is always async).
 */
export async function callFalVideo(
  modelId: string,
  payload: { compiled_prompt: string; compiled_negative?: string; aspect_ratio?: string; duration_seconds?: number },
  apiKey: string,
): Promise<{ request_id: string; status: string }> {
  const input: Record<string, any> = {
    prompt: payload.compiled_prompt,
  }
  if (payload.compiled_negative) input.negative_prompt = payload.compiled_negative
  if (payload.aspect_ratio) input.aspect_ratio = payload.aspect_ratio
  if (payload.duration_seconds) input.duration_seconds = payload.duration_seconds

  const submitRes = await fetch(`${FAL_BASE}/${modelId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
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
  const statusRes = await fetch(`https://queue.fal.run/requests/${requestId}/status`, {
    headers: { 'Authorization': `Key ${apiKey}` },
  })

  if (!statusRes.ok) return { status: 'processing' }
  const statusData = await statusRes.json()

  if (statusData.status === 'COMPLETED') {
    const resultRes = await fetch(`https://queue.fal.run/requests/${requestId}`, {
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
 * pollFalJob — polls until the fal job completes.
 */
export async function pollFalJob(requestId: string, apiKey: string): Promise<any> {
  const maxAttempts = 60
  let attempts = 0

  while (attempts < maxAttempts) {
    attempts++
    await new Promise(r => setTimeout(r, 5000)) // 5s between polls

    const statusRes = await fetch(`https://queue.fal.run/requests/${requestId}/status`, {
      headers: { 'Authorization': `Key ${apiKey}` },
    })

    if (!statusRes.ok) continue
    const status = await statusRes.json()

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(`https://queue.fal.run/requests/${requestId}`, {
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
