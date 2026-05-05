import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { MobileShell } from '@/components/layout/mobile-shell'

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
    <div className="relative flex min-h-screen overflow-hidden">
      {/* ─── Ambient backdrop ─── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* base wash */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(30,27,75,0.55),_transparent_60%)]" />
        {/* blurred orbs */}
        <div className="absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-indigo-600/25 blur-[120px] animate-float" />
        <div className="absolute top-1/3 -right-24 h-[360px] w-[360px] rounded-full bg-fuchsia-600/20 blur-[120px] animate-float" style={{ animationDelay: '-3s' }} />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-cyan-500/15 blur-[120px] animate-float" style={{ animationDelay: '-1.5s' }} />
        {/* faint grid with radial mask */}
        <div
          className="absolute inset-0 bg-grid-faint opacity-[0.6]"
          style={{
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)',
          }}
        />
        {/* subtle film grain */}
        <div
          className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
        />
      </div>

      <SidebarNav org={org} className="hidden md:flex" />
      <MobileShell org={org} />
      <main className="relative z-10 flex-1 overflow-auto pt-14 md:pt-0 gtm-fade-in">{children}</main>
    </div>
  )
}
