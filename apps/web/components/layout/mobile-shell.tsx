'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, ChevronLeft, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Tables } from '@/lib/supabase/types'
import { SidebarNav } from './sidebar-nav'

type Org = Tables<'orgs'>

// Map pathname → human title. Top-level routes get a static title.
// Nested routes are inferred from the parent + show back button.
const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/create': 'Create',
  '/library': 'Library',
  '/icp': 'ICP',
  '/campaigns': 'Campaigns',
  '/settings': 'Settings',
}

const TOP_LEVEL = new Set(Object.keys(TITLES))

function deriveTitle(pathname: string): { title: string; isTopLevel: boolean; parentHref: string | null } {
  if (TITLES[pathname]) return { title: TITLES[pathname], isTopLevel: true, parentHref: null }

  // Find the closest top-level prefix
  for (const top of TOP_LEVEL) {
    if (pathname.startsWith(top + '/')) {
      // Check for /campaigns/new etc — show readable title
      const sub = pathname.slice(top.length + 1).split('/')[0]
      const baseTitle = TITLES[top]
      const subTitle = sub === 'new' ? `New ${baseTitle.replace(/s$/, '')}` : baseTitle
      return { title: subTitle, isTopLevel: false, parentHref: top }
    }
  }

  return { title: 'GTM Engine', isTopLevel: true, parentHref: null }
}

export function MobileShell({ org }: { org: Org }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { title, isTopLevel, parentHref } = deriveTitle(pathname)

  // Close drawer when route changes
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      {/* Top bar — only on mobile */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center justify-between px-3 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {isTopLevel ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (parentHref ? router.push(parentHref) : router.back())}
              aria-label="Back"
              className="flex h-9 items-center gap-0.5 px-2 rounded-lg text-indigo-300 hover:text-indigo-200 hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm">Back</span>
            </button>
          )}
        </div>

        <h1 className="text-sm font-semibold gtm-title truncate px-2 absolute left-1/2 -translate-x-1/2 max-w-[55%] text-center">
          {title}
        </h1>

        <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
          {!isTopLevel && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {isTopLevel && (
            <Link
              href="/dashboard"
              aria-label="Home"
              className="flex h-9 w-9 items-center justify-center rounded-lg"
            >
              <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-glow-violet">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
            </Link>
          )}
        </div>
      </header>

      {/* Drawer overlay */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={cn(
          'md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* Drawer panel */}
      <div
        aria-hidden={!open}
        className={cn(
          'md:hidden fixed top-0 left-0 z-50 h-[100dvh] w-[280px] max-w-[85vw] transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <SidebarNav org={org} onNavigate={() => setOpen(false)} className="w-full h-full pb-[env(safe-area-inset-bottom)]" />
        </div>
      </div>
    </>
  )
}
