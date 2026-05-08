'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, MessageCircle, Globe, AlertCircle, Sparkles } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

type MessageRole = 'user' | 'assistant' | 'system'

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  prompt_tokens?: number
  completion_tokens?: number
  created_at: string
}

interface UsageInfo {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  daily_messages_used: number
  daily_message_cap: number
  daily_tokens_used: number
  daily_token_cap: number
}

export function CampaignChat({ campaignId }: { campaignId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [linkedinConnected, setLinkedinConnected] = useState(false)
  const [error, setError] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const suggestedPrompts = [
    'Give me 3 LinkedIn DM openers tailored to my top prospect.',
    'How is my LinkedIn ad spend pacing this campaign?',
    'Rewrite my value prop based on my top signal.',
    'Should I adjust my ICP based on who engaged?',
  ]

  useEffect(() => {
    async function loadHistory() {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const res = await fetch(`${SUPABASE_URL}/functions/v1/campaign-chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, message: '__load_history__' }),
      })
      const json = await res.json()
      if (res.ok && Array.isArray(json.history)) {
        setMessages(json.history)
        setLinkedinConnected(Boolean(json.linkedin_connected))
      }
    }
    loadHistory()
  }, [campaignId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || pending) return
    setError('')

    const userMsg = input.trim()
    setInput('')
    setMessages(m => [...m, { id: `u-${Date.now()}`, role: 'user', content: userMsg, created_at: new Date().toISOString() }])
    setPending(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch(`${SUPABASE_URL}/functions/v1/campaign-chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, message: userMsg }),
      })
      const json = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          setError('Rate limit exceeded. Please try again later.')
        } else {
          setError(json?.error || 'Failed to send message')
        }
        setMessages(m => m.slice(0, -1))
        return
      }

      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: json.reply, created_at: new Date().toISOString(), ...json.usage }])
      setUsage(json.usage)
      setLinkedinConnected(Boolean(json.linkedin_connected))
    } catch (err) {
      setError((err as Error).message)
      setMessages(m => m.slice(0, -1))
    } finally {
      setPending(false)
    }
  }

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
        {usage && (
          <div className="flex gap-3 text-slate-400">
            <span className={usage.daily_messages_used < 5 ? 'text-amber-300' : ''}>
              {usage.daily_messages_used}/{usage.daily_message_cap} messages
            </span>
            <span>{(usage.daily_tokens_used / 1000).toFixed(1)}K/{(usage.daily_token_cap / 1000).toFixed(0)}K tokens</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-slate-400 text-sm">Ask about your campaign, prospects, or signals.</p>
            <p className="text-slate-500 text-xs mt-1">I can see the brief, your prospects, recent signals, and (if connected) your live LinkedIn ad metrics.</p>
            <div className="mt-4 grid grid-cols-1 gap-2 max-w-xs">
              {suggestedPrompts.map(p => (
                <button
                  key={p}
                  onClick={() => { setInput(p); setTimeout(() => messagesEndRef.current?.focus(), 100) }}
                  className="px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-xs text-slate-300 text-left transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xl px-4 py-3 rounded-lg text-sm ${
                    m.role === 'user'
                      ? 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/30'
                      : 'bg-slate-800/50 text-slate-200 border border-slate-700/30'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 flex gap-2 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06] flex gap-2">
        <Textarea
          value={input}
          onChange={e => { setInput(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !pending) { e.preventDefault(); handleSend() } }}
          placeholder="Ask something..."
          disabled={pending}
          rows={2}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={pending || !input.trim()} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  )
}
