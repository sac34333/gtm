import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { BrandSettingsForm } from '@/components/settings/brand-settings-form'

export const dynamic = 'force-dynamic'

export default async function BrandSettingsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.org_id
  if (!orgId) redirect('/create-org')

  const { data: brand } = await supabase
    .from('brand_contexts')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold gtm-title tracking-tight">Brand &amp; ICP</h1>
        <p className="text-slate-400 text-sm mt-1">
          The information you provided in onboarding. Update any section to keep your generated content on-brand.
        </p>
      </div>

      <BrandSettingsForm initial={brand ?? {}} />
    </div>
  )
}
