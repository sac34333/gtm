import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LinkedInConnectionCard } from '@/components/settings/linkedin-connection-card'
import { LinkedInPostsPanel } from '@/components/settings/linkedin-posts-panel'

export const dynamic = 'force-dynamic'

export default async function IntegrationsSettingsPage() {
  let user = null
  let orgId = null
  let connection = null

  try {
    const supabase = createSupabaseServerClient()
    const result = await supabase.auth.getUser()
    user = result?.data?.user
    orgId = user?.app_metadata?.org_id

    if (!orgId) redirect('/create-org')

    const { data: conn } = await supabase
      .from('org_linkedin_connections')
      .select('ad_account_urn, account_name, last_verified_at, created_at')
      .eq('org_id', orgId)
      .maybeSingle()
    if (conn) connection = conn
  } catch (e) {
    // Silently fail — just show the form
    console.error('Failed to load integrations page:', e)
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

      <LinkedInPostsPanel />
    </div>
  )
}
