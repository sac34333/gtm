'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, Globe, AlertCircle, Sparkles } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface UsageInfo {
  daily_messages_used: number
  daily_message_cap: number
  daily_tokens_used: number
  daily_token_cap: number
}

const SUGGESTED = [
  'Give me 3 LinkedIn DM openers tailored to my top prospect.',
  'Which signals from the last 14 days should I cite in my outbound this week?',
  'Rewrite this campaign for a CFO buyer instead of a Head of Marketing.',
  'How is my LinkedIn ad spend pacing this campaign?',
]

export function CampaignChat({ campaignId }: { campaignId: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [linkedinConnected, setLinkedinConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load history
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data } = await supabase
          .from('campaign_chat_messages')
          .select('id, role, content, created_at')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: true })
          .limit(100)
        if (cancelled) return
        setMessages((data ?? []).filter((m: any) => m.role !== 'system') as ChatMsg[])
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    })()
    return () => { cancelled = true }
  }, [campaignId])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, sending])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setError(null)
    setInput('')

    // Optimistic user msg
    const tempId = `tmp-${Date.now()}`
    setMessages(m => [...m, { id: tempId, role: 'user', content: trimmed, created_at: new Date().toISOString() }])
    setSending(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch(`${SUPABASE_URL}/functions/v1/campaign-chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, message: trimmed }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const errMsg = (json as any)?.detail ?? (json as any)?.error ?? `Request failed (${res.status})`
        throw new Error(errMsg)
      }

      setMessages(m => [...m, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: (json as any).reply,
        created_at: new Date().toISOString(),
      }])
      setUsage((json as any).usage ?? null)
      setLinkedinConnected(Boolean((json as any).linkedin_connected))
    } catch (e) {
      setError((e as Error).message)
      // remove the optimistic user message so they can retry
      setMessages(m => m.filter(x => x.id !== tempId))
      setInput(trimmed) // restore input so they can retry/edit
    } finally {
      setSending(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const remaining = usage ? Math.max(0, usage.daily_message_cap - usage.daily_messages_used) : null

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[500px]">
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] text-xs">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 ${linkedinConnected ? 'text-emerald-300' : 'text-slate-500'}`}>
            <Globe className="w-3.5 h-3.5" />
            {linkedinConnected ? 'LinkedIn live' : 'LinkedIn not connected'}
          </span>
          {!linkedinConnected && (
            <Link href="/settings/integrations" className="text-indigo-300 hover:text-indigo-200 underline">Connect</Link>
          )}
        </div>
        {usage && remaining !== null && (
          <span className={`${remaining < 5 ? 'text-amber-300' : 'text-slate-500'}`}>
            {remaining} of {usage.daily_message_cap} messages left today
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingHistory ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading chat history…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-300 mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-slate-200 font-medium mb-1">Ask anything about this campaign</h3>
            <p className="text-sm text-slate-500 mb-5">
              I can see the brief, your prospects, recent signals, and (if connected) your live LinkedIn ad metrics.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto text-left">
              {SUGGESTED.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-3 py-2 text-xs text-slate-300 bg-slate-900/40 border border-white/[0.06] rounded-lg hover:border-indigo-500/40 hover:bg-slate-900/70 transition text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-indigo-500/15 border border-indigo-500/25 text-slate-100 rounded-br-sm'
                  : 'bg-slate-900/70 border border-white/[0.06] text-slate-200 rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-slate-900/70 border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-slate-400 inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg px-3 py-2 text-xs inline-flex items-start gap-2 max-w-[85%]">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} className="border-t border-white/[0.06] p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about this campaign… (Enter to send, Shift+Enter for newline)"
            rows={2}
            maxLength={2000}
            disabled={sending || (remaining !== null && remaining === 0)}
            className="flex-1 bg-slate-900/40 border-white/10 text-sm resize-none"
          />
          <Button type="submit" disabled={sending || !input.trim() || (remaining !== null && remaining === 0)}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">
          Daily caps: 50 messages and 200,000 tokens per workspace. Resets at 00:00 UTC.
        </p>
      </form>
    </div>
  )
}
