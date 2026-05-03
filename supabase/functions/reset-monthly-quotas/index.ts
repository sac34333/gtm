import { createServiceClient } from '../_shared/db.ts'

Deno.serve(async (req: Request) => {
  // Cron-triggered — accept CRON_SECRET or service role key
  const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronOk = cronSecret.length > 0 && cronSecretHeader === cronSecret
  const srOk = serviceRoleKey.length > 0 && authHeader.includes(serviceRoleKey)
  if (!cronOk && !srOk) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  const db = createServiceClient()

  try {
    const nextResetAt = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth() + 1,
        1,
        0,
        0,
        0,
      ),
    ).toISOString()

    const { error, count } = await db
      .from('orgs')
      .update({
        image_used: 0,
        video_used: 0,
        quota_reset_at: nextResetAt,
      })
      .not('id', 'is', null)
      .select('id', { count: 'exact', head: true })

    if (error) throw error

    console.log(`reset-monthly-quotas: reset quotas for ${count ?? 0} orgs. Next reset: ${nextResetAt}`)
    return new Response(
      JSON.stringify({ reset_orgs: count ?? 0, next_reset_at: nextResetAt }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('reset-monthly-quotas error:', err)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 })
  }
})
