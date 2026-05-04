import { createServiceClient } from '../db.ts'
import { recordUsage } from '../observability.ts'

import { fetchWithRetry } from './router.ts'

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'

export async function callAnthropic(
  modelId: string,
  messages: { role: string; content: string }[],
  apiKey: string,
  opts: {
    org_id?: string
    job_id?: string
    step_key?: string
    key_source_used?: 'platform' | 'user'
    responseFormat?: 'json' | 'text'
    jsonSchema?: any
  } = {},
): Promise<{ text: string }> {
  const start = Date.now()

  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  }

  const body: any = {
    model: modelId,
    max_tokens: 8192,
    messages,
  }

  if (opts.responseFormat === 'json' && opts.jsonSchema) {
    headers['anthropic-beta'] = 'json-schema-2025-05-01'
    body.response_format = { type: 'json', json_schema: opts.jsonSchema }
  }

  const res = await fetchWithRetry(`${ANTHROPIC_BASE}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeoutMs: 90_000,
    provider: 'Anthropic',
  })

  const latency = Date.now() - start

  if (!res.ok) {
    const errText = await res.text()
    if (opts.org_id) {
      await recordUsage(createServiceClient(), {
        org_id: opts.org_id, provider_key: 'anthropic', model_id: modelId,
        step_key: opts.step_key, job_id: opts.job_id,
        key_source_used: opts.key_source_used ?? 'platform',
        latency_ms: latency, success: false,
        error_code: `anthropic_${res.status}`,
      })
    }
    throw new Error(`Anthropic error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text
  if (!text) throw new Error('anthropic_no_output')

  if (opts.org_id) {
    await recordUsage(createServiceClient(), {
      org_id: opts.org_id, provider_key: 'anthropic', model_id: modelId,
      step_key: opts.step_key, job_id: opts.job_id,
      key_source_used: opts.key_source_used ?? 'platform',
      prompt_tokens: data.usage?.input_tokens,
      completion_tokens: data.usage?.output_tokens,
      latency_ms: latency, success: true,
    })
  }

  return { text }
}
