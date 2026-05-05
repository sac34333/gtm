'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, Cpu, BarChart3, CreditCard, Users, Palette } from 'lucide-react'
import { BackButton } from '@/components/layout/back-button'

const TABS = [
  { href: '/settings', label: 'General', icon: Settings, exact: true },
  { href: '/settings/brand', label: 'Brand & ICP', icon: Palette },
  { href: '/settings/models', label: 'Models', icon: Cpu },
  { href: '/settings/usage', label: 'Usage', icon: BarChart3 },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings/team', label: 'Team', icon: Users },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pt-6">
        <BackButton href="/dashboard" label="Back to dashboard" />
      </div>
      <div className="border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6">
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {TABS.map(tab => {
              const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
              const Icon = tab.icon
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? 'border-indigo-400 text-white drop-shadow-[0_0_10px_rgba(129,140,248,0.45)]'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  )
}
