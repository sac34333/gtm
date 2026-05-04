import { createServiceClient } from '../db.ts'
import { recordUsage } from '../observability.ts'

import { fetchWithRetry } from './router.ts'

const OPENAI_BASE = 'https://api.openai.com/v1'

export async function callOpenAI(
  modelId: string,
  messages: { role: string; content: string }[],
  apiKey: string,
  opts: {
    org_id?: string
    job_id?: string
    step_key?: string
    key_source_used?: 'platform' | 'user'
    responseFormat?: any
  } = {},
): Promise<{ text: string }> {
  const start = Date.now()

  const body: any = {
    model: modelId,
    messages,
    max_tokens: 8192,
  }

  if (opts.responseFormat) {
    body.response_format = opts.responseFormat
  }

  const res = await fetchWithRetry(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    timeoutMs: 60_000,
    provider: 'OpenAI',
  })

  const latency = Date.now() - start

  if (!res.ok) {
    const errText = await res.text()
    if (opts.org_id) {
      await recordUsage(createServiceClient(), {
        org_id: opts.org_id, provider_key: 'openai', model_id: modelId,
        step_key: opts.step_key, job_id: opts.job_id,
        key_source_used: opts.key_source_used ?? 'platform',
        latency_ms: latency, success: false,
        error_code: `openai_${res.status}`,
      })
    }
    throw new Error(`OpenAI error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('openai_no_output')

  if (opts.org_id) {
    await recordUsage(createServiceClient(), {
      org_id: opts.org_id, provider_key: 'openai', model_id: modelId,
      step_key: opts.step_key, job_id: opts.job_id,
      key_source_used: opts.key_source_used ?? 'platform',
      prompt_tokens: data.usage?.prompt_tokens,
      completion_tokens: data.usage?.completion_tokens,
      latency_ms: latency, success: true,
    })
  }

  return { text }
}

export async function embedText(
  text: string,
  modelId: string,
  apiKey: string,
  opts: { org_id?: string; job_id?: string } = {},
): Promise<number[]> {
  const start = Date.now()

  const res = await fetchWithRetry(`${OPENAI_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: modelId, input: text }),
    timeoutMs: 30_000,
    provider: 'OpenAI Embeddings',
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI embed error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const embedding = data.data?.[0]?.embedding
  if (!embedding) throw new Error('openai_no_embedding')

  if (opts.org_id) {
    await recordUsage(createServiceClient(), {
      org_id: opts.org_id, provider_key: 'openai', model_id: modelId,
      step_key: 'brand_embedding', job_id: opts.job_id,
      key_source_used: 'platform',
      prompt_tokens: data.usage?.prompt_tokens,
      latency_ms: Date.now() - start, success: true,
    })
  }

  return embedding
}

/**
 * callOpenAIImage — GPT Image 2 via direct OpenAI API.
 * Returns base64 PNG in data[0].b64_json.
 */
export async function callOpenAIImage(
  prompt: string,
  size: string,
  apiKey: string,
  orgId: string,
  jobId: string,
): Promise<{ bytes: Uint8Array; outputUrl: string }> {
  const start = Date.now()
  const res = await fetchWithRetry(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, size, response_format: 'b64_json', n: 1 }),
    timeoutMs: 120_000,
    provider: 'OpenAI Images',
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI image error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('openai_image_no_output')

  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))

  const { createServiceClient: sc } = await import('../db.ts')
  const supabase = sc()
  const storagePath = `${orgId}/${jobId}.png`

  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(storagePath, bytes, { contentType: 'image/png', upsert: true })
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

  const { data: signedData } = await supabase.storage
    .from('assets')
    .createSignedUrl(storagePath, 3600)

  await recordUsage(supabase, {
    org_id: orgId, provider_key: 'openai', model_id: 'gpt-image-2',
    step_key: 'image_generation', job_id: jobId,
    key_source_used: 'user',
    latency_ms: Date.now() - start, success: true,
  })

  return { bytes, outputUrl: signedData?.signedUrl ?? storagePath }
}
