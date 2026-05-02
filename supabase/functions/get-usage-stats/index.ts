import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { validateJWT, extractOrgId, requireRole } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user } = await validateJWT(req)
    const orgId = extractOrgId(user)
    const db = createServiceClient()

    await requireRole(orgId, user.id, 'admin', db)

    const url = new URL(req.url)
    const period = url.searchParams.get('period') ?? 'month'

    if (!['day', 'week', 'month', 'all'].includes(period)) {
      return new Response(JSON.stringify({ error: 'invalid_period' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const intervalMap: Record<string, string> = {
      day: "NOW() - INTERVAL '1 day'",
      week: "NOW() - INTERVAL '7 days'",
      month: "NOW() - INTERVAL '30 days'",
      all: "'1970-01-01'",
    }

    const since = intervalMap[period]

    const { data: rows, error } = await db.rpc('get_usage_stats', {
      p_org_id: orgId,
      p_since: since === "'1970-01-01'" ? '1970-01-01' : null,
      p_period: period,
    })

    // Fallback: direct query if RPC doesn't exist
    let usageRows: any[] = []
    if (error || !rows) {
      const sinceDate = period === 'day' ? new Date(Date.now() - 86400000).toISOString()
        : period === 'week' ? new Date(Date.now() - 7 * 86400000).toISOString()
        : period === 'month' ? new Date(Date.now() - 30 * 86400000).toISOString()
        : '1970-01-01T00:00:00.000Z'

      const { data: rawRows } = await db
        .from('llm_usage_events')
        .select('provider_key, model_id, step_key, key_source_used, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, cost_usd, success')
        .eq('org_id', orgId)
        .gte('created_at', sinceDate)

      usageRows = rawRows ?? []
    } else {
      usageRows = rows
    }

    // Aggregate by (provider_key, model_id, step_key, key_source_used)
    const aggMap = new Map<string, any>()
    let totalCalls = 0
    let totalTokens = 0
    let totalCost = 0
    let platformCalls = 0; let platformCost = 0
    let userCalls = 0; let userCost = 0

    for (const row of usageRows) {
      const key = `${row.provider_key}|${row.model_id}|${row.step_key ?? ''}|${row.key_source_used ?? ''}`
      const cost = Number(row.estimated_cost_usd ?? row.cost_usd ?? 0)
      const tokens = Number(row.total_tokens ?? (Number(row.prompt_tokens ?? 0) + Number(row.completion_tokens ?? 0)))

      if (!aggMap.has(key)) {
        aggMap.set(key, {
          provider_key: row.provider_key,
          model_id: row.model_id,
          step_key: row.step_key,
          key_source_used: row.key_source_used,
          total_calls: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          estimated_cost_usd: 0,
        })
      }

      const agg = aggMap.get(key)
      agg.total_calls += 1
      agg.prompt_tokens += Number(row.prompt_tokens ?? 0)
      agg.completion_tokens += Number(row.completion_tokens ?? 0)
      agg.total_tokens += tokens
      agg.estimated_cost_usd += cost

      totalCalls += 1
      totalTokens += tokens
      totalCost += cost

      if (row.key_source_used === 'platform') {
        platformCalls += 1; platformCost += cost
      } else {
        userCalls += 1; userCost += cost
      }
    }

    const byModel = Array.from(aggMap.values())
      .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd)

    return new Response(
      JSON.stringify({
        period,
        by_model: byModel,
        totals: {
          total_calls: totalCalls,
          total_tokens: totalTokens,
          estimated_cost_usd: Math.round(totalCost * 1e8) / 1e8,
        },
        key_source_split: {
          platform: { calls: platformCalls, cost_usd: Math.round(platformCost * 1e8) / 1e8 },
          user: { calls: userCalls, cost_usd: Math.round(userCost * 1e8) / 1e8 },
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('get-usage-stats error:', (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
