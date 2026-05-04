'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/layout/auth-shell'
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)

    const supabase = getSupabaseBrowserClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })

    setLoading(false)

    // Always show success — never reveal whether an email exists.
    if (error) {
      // Log for ourselves but don't reveal to the user.
      console.warn('reset password error', error.message)
    }
    setSent(true)
    toast.success('If an account exists, a reset link has been sent.')
  }

  return (
    <AuthShell eyebrow="Reset password">
      <Card className="w-full bg-white/[0.04] backdrop-blur-xl border-white/[0.08] shadow-glass-lg">
        <CardHeader className="space-y-1.5 pb-4">
          <CardTitle className="text-2xl gtm-title">Forgot your password?</CardTitle>
          <CardDescription className="text-slate-400">
            Enter your email and we&rsquo;ll send you a link to reset it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <MailCheck className="h-5 w-5 shrink-0 text-emerald-300 mt-0.5" />
                <div className="text-sm text-emerald-100/90 leading-relaxed">
                  Check your inbox at <span className="font-medium text-emerald-200">{email}</span> for a
                  password reset link. The link expires in 1 hour.
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-slate-300 hover:text-white"
                onClick={() => {
                  setSent(false)
                  setEmail('')
                }}
              >
                Send to a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button type="submit" className="w-full bg-indigo-600 text-white font-medium" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : 'Send reset link'}
              </Button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
