'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/layout/auth-shell'
import { WorkflowLoop } from '@/components/marketing/workflow-loop'
import { Loader2, Check } from 'lucide-react'

const PERKS = [
  'Free trial - no credit card required',
  'Live signals tuned to your themes & business - no manual setup',
  'AI content with built-in tags & one-click regenerate - zero prompt engineering',
  'ICP discovery powered by AI search - built around how you actually sell',
  'Campaigns from 1 to 90 days, multi-channel, per-prospect personalised',
]

function MarketingPane() {
  return (
    <div className="space-y-10">
      <div className="space-y-5">
        <h1 className="text-4xl xl:text-5xl font-semibold leading-[1.1] gtm-title">
          Spin up your AI marketing team in under 10 minutes.
        </h1>
        <p className="text-base text-slate-400 leading-relaxed max-w-md">
          Tell us your business and themes once. Get signals, content, ICPs and campaigns flowing the
          same day — without the prompts, the spreadsheets or the per-seat invoices.
        </p>
      </div>

      <ul className="space-y-3">
        {PERKS.map((perk) => (
          <li key={perk} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
              <Check className="h-3 w-3 text-emerald-300" strokeWidth={3} />
            </div>
            <span className="text-sm text-slate-300">{perk}</span>
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
          - a Deeptech IT company building AI-native products that transform how teams work.
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = getSupabaseBrowserClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/create-org` },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    toast.success('Check your email to confirm your account.')
    router.replace('/login')
  }

  return (
    <AuthShell eyebrow="Get started" variant="split" marketing={<MarketingPane />}>
      <Card className="w-full bg-white/[0.04] backdrop-blur-xl border-white/[0.08] shadow-glass-lg">
        <CardHeader className="space-y-1.5 pb-4">
          <CardTitle className="text-2xl gtm-title">Create your account</CardTitle>
          <CardDescription className="text-slate-400">Free to start — no credit card required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Work email</Label>
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
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950/60 border-slate-700 text-slate-100 placeholder:text-slate-500"
              />
              <p className="text-[11px] text-slate-500">At least 8 characters.</p>
            </div>
            <Button type="submit" className="w-full bg-indigo-600 text-white font-medium" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</> : 'Create account'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-300 hover:text-indigo-200 font-medium">
              Sign in
            </Link>
          </p>

          <p className="mt-4 text-[10px] text-center text-slate-600 leading-relaxed">
            By creating an account you agree to our{' '}
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
    </AuthShell>
  )
}

