'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { AuthShell } from '@/components/layout/auth-shell'

function AcceptInviteInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }

    const supabase = getSupabaseBrowserClient()
    supabase.functions
      .invoke('accept-invite', { body: { token } })
      .then(({ error }) => {
        if (error) {
          toast.error('Invalid or expired invite link.')
          setStatus('error')
        } else {
          toast.success('Invite accepted! Welcome aboard.')
          router.replace('/dashboard')
        }
      })
  }, [token, router])

  if (status === 'error') {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 backdrop-blur-xl p-6 text-center space-y-3">
        <p className="text-rose-200 font-medium">This invite link is invalid or has expired.</p>
        <a href="/login" className="inline-flex text-indigo-300 hover:text-indigo-200 underline underline-offset-4 text-sm">
          Sign in instead →
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-8 text-center space-y-3 shadow-glass-lg">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-300 mx-auto" />
      <p className="text-sm gtm-shimmer-text font-medium">Accepting your invite…</p>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <AuthShell eyebrow="Team invite">
      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-8 text-center shadow-glass-lg">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-300 mx-auto" />
          </div>
        }
      >
        <AcceptInviteInner />
      </Suspense>
    </AuthShell>
  )
}

