'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/layout/auth-shell'
import { Loader2, ShieldCheck } from 'lucide-react'

/**
 * The user lands here after clicking the password reset link in their email
 * and being processed by /auth/callback. By that point @supabase/ssr has
 * exchanged the PKCE code, so a recovery session exists in cookies.
 *
 * We simply call updateUser({ password }) — Supabase requires the recovery
 * session to be active for this to succeed.
 */
export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    toast.success('Password updated. Redirecting…')
    // Sign out so the user re-authenticates with the new password
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <AuthShell eyebrow="New password">
      <Card className="w-full bg-white/[0.04] backdrop-blur-xl border-white/[0.08] shadow-glass-lg">
        <CardHeader className="space-y-1.5 pb-4">
          <CardTitle className="text-2xl gtm-title">Set a new password</CardTitle>
          <CardDescription className="text-slate-400">
            Choose a strong password you don&rsquo;t use anywhere else.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSession === false ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100/90">
                This reset link is invalid or has expired. Please request a new one.
              </div>
              <Button asChild className="w-full bg-indigo-600 text-white font-medium">
                <Link href="/forgot-password">Request a new link</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">New password</Label>
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
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-slate-300">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-slate-950/60 border-slate-700 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <Button type="submit" className="w-full bg-indigo-600 text-white font-medium" disabled={loading || hasSession === null}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</>
                ) : (
                  <><ShieldCheck className="w-4 h-4 mr-2" />Update password</>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  )
}
