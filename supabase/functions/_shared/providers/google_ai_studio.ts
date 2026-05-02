import { createServiceClient } from '../db.ts'
import { recordUsage } from '../observability.ts'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * callGoogleAIStudio — handles image, video, and text via Gemini REST API.
 */
export async function callGoogleAIStudio(
  modelId: string,
  payload: any,
  apiKey: string,
): Promise<{ text?: string; bytes?: Uint8Array; outputUrl?: string; jobId?: string }> {
  const start = Date.now()
  const orgId = payload.org_id as string
  const jobId = payload.job_id as string

  // Determine type from payload or model ID
  const isVideo = modelId.includes('veo') || payload.asset_type === 'video'
  const isImage = modelId.includes('image') || payload.asset_type === 'image'

  try {
    if (isImage) {
      return await _generateImage(modelId, payload, apiKey, orgId, jobId, start)
    } else if (isVideo) {
      return await _submitVideoJob(modelId, payload, apiKey, orgId, jobId, start)
    } else {
      return await _generateText(modelId, payload, apiKey, orgId, jobId, start)
    }
  } catch (err) {
    await recordUsage(createServiceClient(), {
      org_id: orgId, provider_key: 'google_ai_studio', model_id: modelId,
      step_key: payload.step_key, job_id: jobId,
      key_source_used: payload.key_source_used ?? 'platform',
      latency_ms: Date.now() - start, success: false,
      error_code: err instanceof Error ? err.message : 'unknown',
    })
    throw err
  }
}

async function _generateText(
  modelId: string, payload: any, apiKey: string,
  orgId: string, jobId: string, start: number,
): Promise<{ text: string }> {
  const supabase = createServiceClient()
  const prompt = payload.prompt ?? payload.compiled_prompt

  const body: any = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 8192 },
  }

  if (payload.response_format === 'json') {
    body.generationConfig.responseMimeType = 'application/json'
    if (payload.response_schema) {
      body.generationConfig.responseSchema = payload.response_schema
    }
  }

  const res = await fetch(
    `${GEMINI_BASE}/models/${modelId}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`google_ai_studio error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('google_ai_studio_no_output')

  const promptTokens = data.usageMetadata?.promptTokenCount
  const completionTokens = data.usageMetadata?.candidatesTokenCount

  await recordUsage(supabase, {
    org_id: orgId, provider_key: 'google_ai_studio', model_id: modelId,
    step_key: payload.step_key, job_id: jobId,
    key_source_used: payload.key_source_used ?? 'platform',
    prompt_tokens: promptTokens, completion_tokens: completionTokens,
    latency_ms: Date.now() - start, success: true,
    input: typeof prompt === 'string' ? prompt.slice(0, 1000) : undefined,
    output: text.slice(0, 1000),
  })

  return { text }
}

async function _generateImage(
  modelId: string, payload: any, apiKey: string,
  orgId: string, jobId: string, start: number,
): Promise<{ bytes: Uint8Array; outputUrl: string }> {
  const supabase = createServiceClient()
  const prompt = payload.compiled_prompt

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  }

  const res = await fetch(
    `${GEMINI_BASE}/models/${modelId}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`google_ai_studio image error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imagePart) throw new Error('google_ai_studio_no_image')

  const bytes = Uint8Array.from(atob(imagePart.inlineData.data), c => c.charCodeAt(0))
  const storagePath = `assets/${orgId}/${jobId}.png`

  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(storagePath, bytes, { contentType: 'image/png', upsert: true })
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

  const { data: signedData } = await supabase.storage
    .from('assets')
    .createSignedUrl(storagePath, 3600)

  await recordUsage(supabase, {
    org_id: orgId, provider_key: 'google_ai_studio', model_id: modelId,
    step_key: 'image_generation', job_id: jobId,
    key_source_used: payload.key_source_used ?? 'platform',
    latency_ms: Date.now() - start, success: true,
  })

  return { bytes, outputUrl: signedData?.signedUrl ?? storagePath }
}

async function _submitVideoJob(
  modelId: string, payload: any, apiKey: string,
  orgId: string, jobId: string, start: number,
): Promise<{ jobId: string; status: string }> {
  const prompt = payload.compiled_prompt

  const body = {
    model: modelId,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { mediaResolution: 'MEDIA_RESOLUTION_MEDIUM' },
  }

  const res = await fetch(
    `${GEMINI_BASE}/models/${modelId}:generateVideo?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`google_ai_studio video error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const operationName = data.name

  await recordUsage(createServiceClient(), {
    org_id: orgId, provider_key: 'google_ai_studio', model_id: modelId,
    step_key: 'video_generation', job_id: jobId,
    key_source_used: payload.key_source_used ?? 'platform',
    latency_ms: Date.now() - start, success: true,
  })

  return { jobId: operationName, status: 'pending' }
}
