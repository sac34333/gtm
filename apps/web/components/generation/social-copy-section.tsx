'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export type CaptionEntry = {
  text: string
  hashtags?: string[]
  char_count?: number
  model_id?: string
  generated_at?: string
}

export type CaptionsBlob = {
  _status?: 'pending' | 'ready' | 'failed'
  _error?: string
  _generated_at?: string
  linkedin?: CaptionEntry
  x?: CaptionEntry
  twitter?: CaptionEntry
  instagram?: CaptionEntry
  whatsapp?: CaptionEntry
  [k: string]: any
}

type Props = {
  jobId: string
  captions: CaptionsBlob | null
  /** Optionally restrict to a single platform (used in inline /create result) */
  preferredPlatform?: string | null
  /** Compact variant for the inline /create surface */
  compact?: boolean
  className?: string
}

const PLATFORM_META: Record<string, { label: string; icon: string; charLimit: number; warnRatio: number }> = {
  linkedin:  { label: 'LinkedIn',  icon: 'in', charLimit: 3000, warnRatio: 0.85 },
  x:         { label: 'X',          icon: '𝕏',  charLimit: 280,  warnRatio: 0.90 },
  twitter:   { label: 'X',          icon: '𝕏',  charLimit: 280,  warnRatio: 0.90 },
  instagram: { label: 'Instagram',  icon: 'IG', charLimit: 2200, warnRatio: 0.85 },
  whatsapp:  { label: 'WhatsApp',   icon: 'WA', charLimit: 1024, warnRatio: 0.85 },
}

const PLATFORM_ORDER = ['linkedin', 'x', 'instagram', 'whatsapp']

function formatFullText(c: CaptionEntry): string {
  const tags = (c.hashtags ?? []).join(' ')
  if (!tags) return c.text
  // Hashtags already inline? avoid duplicating.
  if (c.text.includes(tags) || (c.hashtags ?? []).every(h => c.text.includes(h))) return c.text
  return `${c.text}\n\n${tags}`
}

export function SocialCopySection({ jobId, captions, preferredPlatform, compact, className }: Props) {
  const [localCaptions, setLocalCaptions] = useState<CaptionsBlob | null>(captions)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set())

  useEffect(() => { setLocalCaptions(captions) }, [captions])

  // Realtime subscription to captions_ready broadcast
  useEffect(() => {
    if (!jobId) return
    const supabase = getSupabaseBrowserClient()
    const channel = supabase.channel(`job:${jobId}`)
      .on('broadcast', { event: 'captions_ready' }, (payload: any) => {
        if (payload?.payload?.captions) setLocalCaptions(payload.payload.captions)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [jobId])

  // If status pending, poll the row every 3s as a fallback to realtime
  useEffect(() => {
    if (localCaptions?._status !== 'pending') return
    const supabase = getSupabaseBrowserClient()
    const t = setInterval(async () => {
      const { data } = await supabase
        .from('generation_jobs')
        .select('captions')
        .eq('id', jobId)
        .single()
      if (data?.captions) {
        setLocalCaptions(data.captions as CaptionsBlob)
        if (data.captions._status !== 'pending') clearInterval(t)
      }
    }, 3500)
    return () => clearInterval(t)
  }, [jobId, localCaptions?._status])

  const platforms = useMemo(() => {
    if (preferredPlatform) {
      const p = preferredPlatform === 'twitter' ? 'x' : preferredPlatform
      return PLATFORM_ORDER.includes(p) ? [p] : PLATFORM_ORDER
    }
    return PLATFORM_ORDER
  }, [preferredPlatform])

  const status = localCaptions?._status ?? null

  async function regenerate(platform?: string) {
    const supabase = getSupabaseBrowserClient()
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    if (!token) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) return

    const tag = platform ?? '__all__'
    setRegenerating(prev => new Set(prev).add(tag))

    // Mark pending locally for instant feedback
    setLocalCaptions(prev => ({ ...(prev ?? {}), _status: 'pending' }))

    try {
      await fetch(`${url}/functions/v1/generate-captions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          job_id: jobId,
          regenerate: true,
          platforms: platform ? [platform] : undefined,
        }),
      })
    } catch {
      // ignore — polling/realtime will reconcile
    } finally {
      setRegenerating(prev => {
        const next = new Set(prev)
        next.delete(tag)
        return next
      })
    }
  }

  function copy(platform: string, text: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(platform)
      setTimeout(() => setCopied(prev => (prev === platform ? null : prev)), 1500)
    })
  }

  // No captions at all and no pending status — render nothing
  if (!localCaptions && !status) return null

  // Pending shimmer (no captions yet, generating for the first time)
  const renderingPending = status === 'pending' && platforms.every(p => !localCaptions?.[p]?.text)

  return (
    <section className={`space-y-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">Social copy</h3>
          {status === 'pending' && (
            <span className="text-xs text-amber-600 dark:text-amber-400">Writing captions…</span>
          )}
          {status === 'ready' && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Ready ✓</span>
          )}
          {status === 'failed' && (
            <span className="text-xs text-red-600 dark:text-red-400">Failed — try regenerating</span>
          )}
        </div>
        {!preferredPlatform && status !== 'pending' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => regenerate()}
            disabled={regenerating.has('__all__')}
            className="h-7 text-xs"
          >
            ✨ {regenerating.has('__all__') ? 'Regenerating…' : 'Regenerate all'}
          </Button>
        )}
      </div>

      {renderingPending ? (
        <div className="space-y-2">
          {platforms.map(p => (
            <div key={p} className="rounded-md border border-zinc-200/70 dark:border-zinc-800 p-3 animate-pulse">
              <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
              <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded mb-1" />
              <div className="h-3 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className={compact ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
          {platforms.map(platform => {
            const meta = PLATFORM_META[platform]
            const cap = localCaptions?.[platform] as CaptionEntry | undefined
            const isEditing = !!editing[platform]
            const liveText = isEditing ? (edits[platform] ?? '') : (cap ? formatFullText(cap) : '')
            const charCount = liveText.length
            const overLimit = meta && charCount > meta.charLimit
            const warn = meta && !overLimit && charCount > meta.charLimit * meta.warnRatio
            const isRegen = regenerating.has(platform) || regenerating.has('__all__')

            return (
              <div
                key={platform}
                className="rounded-lg border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold">
                      {meta?.icon ?? '?'}
                    </span>
                    {meta?.label ?? platform}
                  </div>
                  {meta && (
                    <span
                      className={
                        overLimit
                          ? 'text-[10px] font-medium text-red-600 dark:text-red-400'
                          : warn
                            ? 'text-[10px] font-medium text-amber-600 dark:text-amber-400'
                            : 'text-[10px] text-zinc-500'
                      }
                    >
                      {charCount}/{meta.charLimit}
                    </span>
                  )}
                </div>

                {!cap && !isRegen ? (
                  <div className="text-xs text-zinc-500 italic py-2">
                    No caption for this platform yet.
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerate(platform)}
                      className="ml-2 h-6 text-xs px-2"
                    >
                      Generate
                    </Button>
                  </div>
                ) : isRegen && !cap ? (
                  <div className="space-y-1.5 py-1 animate-pulse">
                    <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                ) : isEditing ? (
                  <Textarea
                    value={edits[platform] ?? ''}
                    onChange={(e) => setEdits(prev => ({ ...prev, [platform]: e.target.value }))}
                    rows={Math.min(10, Math.max(4, Math.ceil((edits[platform]?.length ?? 0) / 80)))}
                    className="text-sm font-normal leading-relaxed"
                  />
                ) : (
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-zinc-800 dark:text-zinc-200 max-h-56 overflow-y-auto">
                    {cap ? formatFullText(cap) : ''}
                  </pre>
                )}

                {cap && (
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copy(platform, isEditing ? (edits[platform] ?? '') : formatFullText(cap))}
                      className="h-7 text-xs px-2"
                    >
                      {copied === platform ? '✓ Copied' : 'Copy'}
                    </Button>
                    {isEditing ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(prev => ({ ...prev, [platform]: false }))}
                        className="h-7 text-xs px-2"
                      >
                        Done
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEdits(prev => ({ ...prev, [platform]: formatFullText(cap) }))
                          setEditing(prev => ({ ...prev, [platform]: true }))
                        }}
                        className="h-7 text-xs px-2"
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerate(platform)}
                      disabled={isRegen}
                      className="h-7 text-xs px-2 ml-auto"
                    >
                      {isRegen ? '…' : '↻'}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
