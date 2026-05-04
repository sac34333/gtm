'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface BackButtonProps {
  href?: string
  label?: string
  className?: string
}

export function BackButton({ href, label = 'Back', className = '' }: BackButtonProps) {
  const router = useRouter()
  function handleClick() {
    if (href) router.push(href)
    else router.back()
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        'inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors mb-4 ' +
        className
      }
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </button>
  )
}
