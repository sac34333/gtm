import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LinkedInConnectionCard } from '@/components/settings/linkedin-connection-card'

export const dynamic = 'force-dynamic'

export default async function IntegrationsSettingsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.org_id
  if (!orgId) redirect('/create-org')

  let connection = null
  try {
    const { data: conn, error } = await supabase
      .from('org_linkedin_connections')
      .select('ad_account_urn, account_name, last_verified_at, created_at')
      .eq('org_id', orgId)
      .maybeSingle()
    if (!error) connection = conn
  } catch (e) {
    // Silently fail — just show the form
    console.error('Failed to load LinkedIn connection:', e)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold gtm-title tracking-tight">Integrations</h1>
        <p className="text-slate-400 text-sm mt-1">
          Connect external accounts so the in-app campaign assistant can answer questions about your real data.
        </p>
      </div>

      <LinkedInConnectionCard
        initialConnection={connection ? {
          ad_account_urn: connection.ad_account_urn as string,
          account_name: (connection.account_name as string | null) ?? null,
          last_verified_at: connection.last_verified_at as string,
          created_at: connection.created_at as string,
        } : null}
      />
    </div>
  )
}
