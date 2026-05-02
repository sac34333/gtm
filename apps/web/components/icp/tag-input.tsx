'use client'

import { useState, useCallback } from 'react'
import { X, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  max?: number
}

export function TagInput({ tags, onChange, placeholder = 'Type and press Enter', max = 10 }: TagInputProps) {
  const [input, setInput] = useState('')

  const addTag = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed || tags.includes(trimmed) || tags.length >= max) return
    onChange([...tags, trimmed])
    setInput('')
  }, [tags, onChange, max])

  const removeTag = (tag: string) => onChange(tags.filter(t => t !== tag))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <Badge key={tag} variant="secondary" className="bg-indigo-900/30 border border-indigo-700/40 text-indigo-300 pl-2.5 pr-1.5 py-1 flex items-center gap-1">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-white ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(input) }
            if (e.key === ',') { e.preventDefault(); addTag(input) }
          }}
          placeholder={tags.length >= max ? `Max ${max} tags` : placeholder}
          disabled={tags.length >= max}
          className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm h-9"
        />
        <button
          type="button"
          onClick={() => addTag(input)}
          disabled={!input.trim() || tags.length >= max}
          className="px-3 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
