import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { IngestionSettings } from '@/components/settings/ingestion-settings'

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.org_id
  if (!orgId) redirect('/create-org')

  const [{ data: org }, { data: orgMember }, { data: apiKeys }] = await Promise.all([
    supabase.from('orgs').select('signal_ingestion_enabled, signal_ingestion_frequency, last_signal_ingestion_at, plan_tier').eq('id', orgId).single(),
    supabase.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user!.id).single(),
    supabase.from('org_api_keys').select('key_name').eq('org_id', orgId),
  ])

  const role = orgMember?.role ?? 'member'
  const isAdmin = role === 'admin' || role === 'owner'
  const existingKeys = (apiKeys ?? []).map((k) => k.key_name)

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-6 md:py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold gtm-title tracking-tight">General Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Configure your organisation&apos;s signal ingestion and data sources.</p>
      </div>

      <IngestionSettings
        initialEnabled={org?.signal_ingestion_enabled ?? false}
        initialFrequency={org?.signal_ingestion_frequency ?? 'every_2_days'}
        lastIngestionAt={org?.last_signal_ingestion_at ?? null}
        existingKeys={existingKeys}
        isAdmin={isAdmin}
      />
    </div>
  )
}
