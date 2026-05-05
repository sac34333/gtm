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
import { WorkflowLoop } from '@/components/marketing/workflow-loop'
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
    title: 'Live signals from your themes',
    body: 'Tell us your business and themes once. Daily, scored signals from across the digital landscape — tuned to your market.',
  },
  {
    icon: Wand2,
    title: 'Content without prompt fatigue',
    body: 'No prompt engineering. Pick a tag, pick a tone — generate, refine and regenerate until it fits your brand.',
  },
  {
    icon: Users,
    title: 'AI-search ICP discovery',
    body: 'Describe who you sell to. We surface real prospects, score fit 0–100 and enrich each one — built around how you actually sell.',
  },
  {
    icon: Zap,
    title: 'Campaigns built for your prospects',
    body: 'Pick media channels, pick a length (1–90 days), approve copy inline. Calendar, briefs and per-prospect copy — built for you.',
  },
]

function MarketingPane() {
  return (
    <div className="space-y-10">
      <div className="space-y-5">
        <h1 className="text-4xl xl:text-5xl font-semibold leading-[1.1] gtm-title">
          The work of a marketing team. Delivered in minutes.
        </h1>
        <p className="text-base text-slate-400 leading-relaxed max-w-md">
          One AI-driven workspace that turns live market signals into on-brand content, finds the
          prospects who actually fit, and ships fully personalised campaigns — without juggling tools
          or prompts.
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

      <WorkflowLoop />

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-5 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Always on the best AI</p>
        <p className="text-[13px] text-slate-300 leading-relaxed">
          We benchmark and route every step to the AI model that performs best today and swap it
          out the moment a better one launches. You never have to think about it.
        </p>
        <p className="text-[12px] text-slate-500 leading-relaxed">
          Prefer to use your own model accounts? Bring Your Own Keys (BYOK) is available on request —
          we&apos;ll route through your OpenAI, Anthropic or Gemini keys instead.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">Built by</p>
        <p className="text-sm text-slate-300 leading-relaxed">
          <a href="https://qubitlyventures.com" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-100 hover:text-indigo-300 transition-colors">
            Qubitly Ventures
          </a>{' '}
          — a Deeptech IT company building AI-native products that transform how teams work.
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


