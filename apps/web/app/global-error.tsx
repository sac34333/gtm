'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Something went wrong</h1>
          <p className="text-slate-400 text-sm">An unexpected error occurred. Our team has been notified.</p>
          <Button variant="outline" className="border-white/10 text-white" onClick={reset}>
            Try again
          </Button>
        </div>
      </body>
    </html>
  )
}
