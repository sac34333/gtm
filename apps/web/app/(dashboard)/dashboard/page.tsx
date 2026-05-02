import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SignalCard } from '@/components/signals/signal-card'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.org_id

  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_archived', false)
    .order('relevance_score', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(50)

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Signal Feed</h1>
      {!signals?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground text-lg">No signals yet</p>
          <p className="text-muted-foreground text-sm mt-2">
            Configure your data sources in Settings to start ingesting market signals.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  )
}
