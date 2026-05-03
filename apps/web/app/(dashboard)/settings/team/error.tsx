'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function TeamError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 flex flex-col items-center gap-4">
      <AlertTriangle className="w-10 h-10 text-amber-400" />
      <p className="text-slate-100 font-semibold">Failed to load team members</p>
      <p className="text-slate-400 text-sm text-center max-w-sm">
        An unexpected error occurred. Please try again.
      </p>
      <Button variant="outline" className="border-slate-700 text-slate-100" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
