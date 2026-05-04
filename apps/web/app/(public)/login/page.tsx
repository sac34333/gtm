'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/layout/auth-shell'
import { Loader2, Wand2, Radar, Users, Zap } from 'lucide-react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'
  const errorParam = searchParams.get('error')

  // Surface any error returned from /auth/callback (expired link, etc.)
  useEffect(() => {
    if (errorParam) {
      toast.error(errorParam)
      // Strip the param from the URL so it doesn't re-fire
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [errorParam])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = getSupabaseBrowserClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    router.replace(redirectTo)
  }

  return (
    <Card className="w-full bg-white/[0.04] backdrop-blur-xl border-white/[0.08] shadow-glass-lg">
      <CardHeader className="space-y-1.5 pb-4">
        <CardTitle className="text-2xl gtm-title">Welcome back</CardTitle>
        <CardDescription className="text-slate-400">Sign in to continue to GTM Engine</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-950/60 border-slate-700 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-slate-500 hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950/60 border-slate-700 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <Button type="submit" className="w-full bg-indigo-600 text-white font-medium" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</> : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          New to GTM Engine?{' '}
          <Link href="/signup" className="text-indigo-300 hover:text-indigo-200 font-medium">
            Create an account
          </Link>
        </p>

        <p className="mt-4 text-[10px] text-center text-slate-600 leading-relaxed">
          By continuing you agree to our{' '}
          <a href="https://qubitlyventures.com/en/terms-of-service" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 underline underline-offset-2">
            Terms
          </a>{' '}
          &{' '}
          <a href="https://qubitlyventures.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </p>
      </CardContent>
    </Card>
  )
}

const FEATURES = [
  {
    icon: Radar,
    title: 'Real-time signal intelligence',
    body: 'Surface market shifts, competitor moves, and ICP triggers across 12+ live data sources.',
  },
  {
    icon: Wand2,
    title: 'AI creative on demand',
    body: 'Generate on-brand images, videos, and copy in seconds — routed to the best model for the job.',
  },
  {
    icon: Users,
    title: 'ICP enrichment & personalisation',
    body: 'Waterfall enrichment plus 1:1 personalised outreach for every prospect in your pipeline.',
  },
  {
    icon: Zap,
    title: 'End-to-end campaign workflows',
    body: 'From signal to creative to outreach — all in one workspace, with usage tracking baked in.',
  },
]

function MarketingPane() {
  return (
    <div className="space-y-10">
      <div className="space-y-5">
        <h1 className="text-4xl xl:text-5xl font-semibold leading-[1.1] gtm-title">
          The AI-native go-to-market workspace.
        </h1>
        <p className="text-base text-slate-400 leading-relaxed max-w-md">
          Detect signals, generate creative, enrich ICPs and run personalised outreach — all from a single
          AI-routed control plane built for modern revenue teams.
        </p>
      </div>

      <ul className="space-y-5">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-4">
            <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 via-violet-500/20 to-fuchsia-500/20 border border-white/[0.08]">
              <Icon className="h-4 w-4 text-indigo-300" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">{title}</p>
              <p className="text-[13px] text-slate-500 leading-relaxed">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex -space-x-2">
            {['from-indigo-400 to-indigo-600', 'from-violet-400 to-violet-600', 'from-fuchsia-400 to-fuchsia-600', 'from-cyan-400 to-cyan-600'].map((g) => (
              <div key={g} className={`h-7 w-7 rounded-full bg-gradient-to-br ${g} ring-2 ring-slate-950`} />
            ))}
          </div>
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Trusted by modern GTM teams</span>
        </div>
        <p className="text-[13px] text-slate-400 italic leading-relaxed">
          &ldquo;We replaced four disconnected tools with one AI-native workspace. Our team ships campaigns
          in hours, not weeks.&rdquo;
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Welcome back" variant="split" marketing={<MarketingPane />}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}


