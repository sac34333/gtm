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
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { error, count } = await db
      .from('signals')
      .delete()
      .eq('source_type', 'apify_linkedin')
      .lt('scraped_at', cutoff)
      .neq('status', 'selected')
      .select('id', { count: 'exact', head: true })

    if (error) throw error

    console.log(`cleanup-apify-signals: deleted ${count ?? 0} LinkedIn signals older than 24h`)
    return new Response(
      JSON.stringify({ deleted: count ?? 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('cleanup-apify-signals error:', err)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 })
  }
})
