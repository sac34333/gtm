'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function BrandError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 flex flex-col items-center gap-4">
      <AlertTriangle className="w-10 h-10 text-amber-400" />
      <p className="text-slate-100 font-semibold">Failed to load brand settings</p>
      <p className="text-slate-400 text-sm text-center max-w-sm">
        Your brand profile could not be loaded. Please try again.
      </p>
      <Button variant="outline" className="border-slate-700 text-slate-100" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
