'use client'

import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
}

export function MultiSelect({ options, selected, onChange, placeholder = 'Select...' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between min-h-9 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:border-slate-600 transition-colors"
      >
        <span className="flex flex-wrap gap-1 flex-1 text-left">
          {selected.length === 0 ? (
            <span className="text-slate-500">{placeholder}</span>
          ) : (
            selected.map(v => (
              <Badge key={v} variant="secondary" className="bg-indigo-900/30 border border-indigo-700/40 text-indigo-300 text-xs py-0">
                {v}
              </Badge>
            ))
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 ml-2 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-slate-800 border border-slate-700 shadow-xl shadow-black/40 py-1">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <span>{opt}</span>
              {selected.includes(opt) && <Check className="w-4 h-4 text-indigo-400" />}
            </button>
          ))}
        </div>
      )}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  )
}
