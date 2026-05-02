'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

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
      <p className="text-muted-foreground">
        This invite link is invalid or has expired.{' '}
        <a href="/login" className="underline">
          Sign in
        </a>
      </p>
    )
  }

  return <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
}

export default function AcceptInvitePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}>
        <AcceptInviteInner />
      </Suspense>
    </main>
  )
}

