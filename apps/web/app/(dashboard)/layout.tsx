import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/layout/sidebar-nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = user.app_metadata?.org_id
  if (!orgId) redirect('/create-org')

  // Fetch org data
  const { data: org } = await supabase.from('orgs').select('*').eq('id', orgId).single()

  if (!org?.onboarding_complete) redirect('/onboarding')

  return (
    <div className="flex min-h-screen">
      <SidebarNav org={org} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
