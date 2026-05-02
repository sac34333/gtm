import { createServiceClient } from '../_shared/db.ts'

Deno.serve(async (req: Request) => {
  // Cron-triggered — verify service role key
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!authHeader.includes(serviceRoleKey)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  const db = createServiceClient()

  try {
    const { error, count } = await db
      .from('signals')
      .update({ status: 'archived' })
      .lt('scraped_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .neq('status', 'selected')
      .select('id', { count: 'exact', head: true })

    if (error) throw error

    console.log(`archive-old-signals: archived ${count ?? 0} signals`)
    return new Response(
      JSON.stringify({ archived: count ?? 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('archive-old-signals error:', err)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 })
  }
})
