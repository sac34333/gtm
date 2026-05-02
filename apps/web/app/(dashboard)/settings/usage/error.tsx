'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function UsageError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 flex flex-col items-center gap-4">
      <AlertTriangle className="w-10 h-10 text-amber-400" />
      <p className="text-white font-semibold">Failed to load usage stats</p>
      <p className="text-slate-400 text-sm text-center max-w-sm">
        Could not fetch usage data. Please try again.
      </p>
      <Button variant="outline" className="border-white/10 text-white" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
