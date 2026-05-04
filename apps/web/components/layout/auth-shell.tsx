import Link from 'next/link'
import { Sparkles } from 'lucide-react'

interface AuthShellProps {
  children: React.ReactNode
  /** Small label shown above the brand mark. Optional. */
  eyebrow?: string
  /**
   * Layout variant.
   * - `centered` (default): single column, brand on top, form centered.
   *   Best for short flows like create-org and invite-accept.
   * - `split`: two-column SaaS layout — marketing pane on the left (lg+),
   *   form on the right. Use for login & signup. Pair with `marketing`.
   */
  variant?: 'centered' | 'split'
  /** Optional marketing pane content (only rendered when variant="split"). */
  marketing?: React.ReactNode
}

/**
 * Shared visual shell for unauthenticated pages (login, signup,
 * create-org, invite/accept). Provides the GTM Engine ambient
 * backdrop, brand mark, Qubitly Ventures attribution, and a
 * consistent layout. Functionality is unchanged.
 */
export function AuthShell({ children, eyebrow, variant = 'centered', marketing }: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      {/* ─── Ambient backdrop ─── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(30,27,75,0.55),_transparent_60%)]" />
        <div className="absolute -top-32 left-1/4 h-[420px] w-[420px] rounded-full bg-indigo-600/25 blur-[120px] animate-float" />
        <div className="absolute bottom-0 right-1/4 h-[360px] w-[360px] rounded-full bg-fuchsia-600/20 blur-[120px] animate-float" style={{ animationDelay: '-3s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[260px] w-[260px] rounded-full bg-cyan-500/10 blur-[120px] animate-float" style={{ animationDelay: '-1.5s' }} />
        <div
          className="absolute inset-0 bg-grid-faint opacity-[0.5]"
          style={{
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 70% 50% at 50% 40%, black 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 50% at 50% 40%, black 30%, transparent 80%)',
          }}
        />
      </div>

      {variant === 'split' && marketing ? (
        <div className="flex-1 grid lg:grid-cols-2 gap-10 px-4 sm:px-8 lg:px-14 py-10 lg:py-14">
          {/* Marketing pane — hidden on mobile to keep form above the fold */}
          <section className="hidden lg:flex flex-col justify-between gtm-fade-up">
            <BrandHeader eyebrow={eyebrow} />
            <div className="max-w-lg">{marketing}</div>
            <QubitlyFooter />
          </section>

          {/* Form pane */}
          <section className="flex flex-col items-center justify-center">
            <div className="lg:hidden mb-8 flex justify-center">
              <BrandHeader eyebrow={eyebrow} compact />
            </div>
            <div className="w-full max-w-sm gtm-fade-up">{children}</div>
            <div className="lg:hidden mt-10">
              <QubitlyFooter compact />
            </div>
          </section>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm space-y-6 gtm-fade-up">
            <div className="flex justify-center">
              <BrandHeader eyebrow={eyebrow} compact />
            </div>
            {children}
            <QubitlyFooter compact />
          </div>
        </div>
      )}
    </main>
  )
}

function BrandHeader({ eyebrow, compact = false }: { eyebrow?: string; compact?: boolean }) {
  return (
    <div className={compact ? 'flex flex-col items-center gap-3' : 'flex flex-col items-start gap-4'}>
      <Link href="/" className="group inline-flex items-center gap-2.5">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-glow-violet transition-transform group-hover:scale-105">
          <Sparkles className="h-5 w-5 text-white" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/15" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold gtm-title">GTM Engine</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">by Qubitly Ventures</span>
        </div>
      </Link>
      {eyebrow && !compact && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
          {eyebrow}
        </span>
      )}
      {eyebrow && compact && (
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
      )}
    </div>
  )
}

function QubitlyFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={compact ? 'text-center text-[11px] text-slate-500 space-y-2' : 'flex flex-col gap-2 text-[11px] text-slate-500'}>
      <p>
        © {new Date().getFullYear()}{' '}
        <a
          href="https://qubitlyventures.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-indigo-300 transition-colors"
        >
          Qubitly Ventures
        </a>
        . All rights reserved.
      </p>
      <div className={compact ? 'flex justify-center gap-3' : 'flex gap-4'}>
        <a href="https://qubitlyventures.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
          Privacy
        </a>
        <a href="https://qubitlyventures.com/en/terms-of-service" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
          Terms
        </a>
        <a href="mailto:contact@qubitlyventures.com" className="hover:text-slate-300 transition-colors">
          Contact
        </a>
      </div>
    </footer>
  )
}
