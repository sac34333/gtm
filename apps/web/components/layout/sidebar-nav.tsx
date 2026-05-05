'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { type Tables } from '@/lib/supabase/types'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  Sparkles,
  Library,
  Users,
  Megaphone,
  Settings,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Org = Tables<'orgs'>

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Create', href: '/create', icon: Sparkles },
  { label: 'Library', href: '/library', icon: Library },
  { label: 'ICP', href: '/icp', icon: Users },
  { label: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export function SidebarNav({ org, onNavigate, className }: { org: Org; onNavigate?: () => void; className?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    onNavigate?.()
    router.replace('/login')
  }

  return (
    <aside className={cn('relative z-20 flex h-screen w-56 flex-col border-r border-white/[0.06] bg-slate-950/60 backdrop-blur-xl px-3 py-4', className)}>
      <div className="mb-6 px-2 flex items-center gap-2">
        <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-glow-violet">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold truncate gtm-title">{org.name}</span>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                isActive
                  ? 'gtm-sidebar-active font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-200')} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-white/[0.06] pt-3 space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/[0.04]"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
        <a
          href="https://qubitlyventures.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block px-2 text-[10px] uppercase tracking-[0.18em] text-slate-600 hover:text-indigo-300 transition-colors"
        >
          by Qubitly Ventures
        </a>
      </div>
    </aside>
  )
}
