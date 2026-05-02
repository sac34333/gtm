/**
 * Observability: records LLM usage to llm_usage_events (DB) and Langfuse SDK.
 * Called by all non-OpenRouter provider adapters (fal, google_ai_studio, anthropic, openai).
 * OpenRouter uses Broadcast — do NOT call recordUsage() in openrouter.ts.
 *
 * Both tracks are fire-and-forget. Failures never affect the main call.
 */

export interface UsageEvent {
  org_id: string
  provider_key: string
  model_id: string
  step_key?: string
  job_id?: string
  key_source_used: 'platform' | 'user'
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  latency_ms: number
  success: boolean
  error_code?: string
  // For Langfuse trace
  input?: string
  output?: string
}

export async function recordUsage(
  supabase: any,
  event: UsageEvent,
): Promise<void> {
  const { org_id, provider_key, model_id, step_key, job_id,
    key_source_used, prompt_tokens, completion_tokens, latency_ms,
    success, error_code, input, output } = event

  const total_tokens = event.total_tokens ??
    (((prompt_tokens ?? 0) + (completion_tokens ?? 0)) || undefined)

  // ── Track 1: llm_usage_events DB row ────────────────────────────────────
  try {
    // Calculate estimated cost from available_models if possible
    let estimated_cost_usd: number | null = null
    try {
      const { data: modelRow } = await supabase
        .from('available_models')
        .select('cost_per_1k_input_tokens, cost_per_1k_output_tokens')
        .eq('provider_key', provider_key)
        .eq('model_id', model_id)
        .single()

      if (modelRow) {
        const inputCost = (prompt_tokens ?? 0) / 1000 * (modelRow.cost_per_1k_input_tokens ?? 0)
        const outputCost = (completion_tokens ?? 0) / 1000 * (modelRow.cost_per_1k_output_tokens ?? 0)
        if (inputCost + outputCost > 0) {
          estimated_cost_usd = inputCost + outputCost
        }
      }
    } catch { /* ignore cost lookup failure */ }

    await supabase.from('llm_usage_events').insert({
      org_id,
      provider_key,
      model_id,
      step_key: step_key ?? null,
      job_id: job_id ?? null,
      key_source_used,
      prompt_tokens: prompt_tokens ?? null,
      completion_tokens: completion_tokens ?? null,
      total_tokens: total_tokens ?? null,
      estimated_cost_usd,
      latency_ms,
      success,
      error_code: error_code ?? null,
    })
  } catch (err) {
    // Log to Sentry silently — never throw
    try {
      const Sentry = await import('npm:@sentry/deno')
      Sentry.captureException(err)
    } catch { /* ignore */ }
  }

  // ── Track 2: Langfuse SDK trace ─────────────────────────────────────────
  const langfusePublicKey = Deno.env.get('LANGFUSE_PUBLIC_KEY')
  if (!langfusePublicKey) return // Langfuse not configured — skip silently

  try {
    const Langfuse = (await import('npm:langfuse')).default
    const langfuse = new Langfuse({
      publicKey: langfusePublicKey,
      secretKey: Deno.env.get('LANGFUSE_SECRET_KEY')!,
      baseUrl: Deno.env.get('LANGFUSE_HOST') ?? 'https://cloud.langfuse.com',
    })

    const trace = langfuse.trace({
      name: `${provider_key}/${step_key ?? 'unknown'}`,
      userId: org_id,
      sessionId: job_id,
      metadata: { org_id, step_key, provider_key, key_source_used },
    })

    trace.generation({
      name: `${provider_key}/${model_id}`,
      model: model_id,
      modelParameters: { provider: provider_key },
      input: input ?? null,
      output: output ?? null,
      usage: {
        promptTokens: prompt_tokens,
        completionTokens: completion_tokens,
        totalTokens: total_tokens,
      },
      startTime: new Date(Date.now() - latency_ms),
      endTime: new Date(),
      level: success ? 'DEFAULT' : 'ERROR',
      statusMessage: error_code,
    })

    await langfuse.shutdownAsync()
  } catch (err) {
    try {
      const Sentry = await import('npm:@sentry/deno')
      Sentry.captureException(err)
    } catch { /* ignore */ }
  }
}
