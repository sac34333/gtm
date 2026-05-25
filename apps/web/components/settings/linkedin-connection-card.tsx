'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Globe, ShieldCheck, Trash2, ExternalLink, Loader2, BookOpen, Building2, AlertTriangle, Lock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/use-role'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

interface ExistingConnection {
  ad_account_urn: string
  account_name: string | null
  last_verified_at: string
  created_at: string
  consent_given_at?: string | null
}

async function callEdge(path: string, body?: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not signed in')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (json as any)?.detail ?? (json as any)?.error ?? `Request failed (${res.status})`
    throw new Error(msg)
  }
  return json
}

export function LinkedInConnectionCard({ initialConnection }: { initialConnection: ExistingConnection | null }) {
  const [connection, setConnection] = useState(initialConnection)
  const [accessToken, setAccessToken] = useState('')
  const [adAccountId, setAdAccountId] = useState('')
  const [accountName, setAccountName] = useState('')
  const [consent1, setConsent1] = useState(false)
  const [consent2, setConsent2] = useState(false)
  const [consent3, setConsent3] = useState(false)
  const [pending, startTransition] = useTransition()
  const [disconnecting, setDisconnecting] = useState(false)
  const { canEdit, isViewer } = useRole()

  const allConsented = consent1 && consent2 && consent3

  function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    const trimmedToken = accessToken.trim()
    const trimmedAcct = adAccountId.trim()
    if (!trimmedToken) { toast.error('Paste your LinkedIn access token'); return }
    if (!/^\d+$/.test(trimmedAcct)) { toast.error('Ad account ID must be digits only (e.g. 506795881)'); return }

    const urn = `urn:li:sponsoredAccount:${trimmedAcct}`

    startTransition(async () => {
      try {
        const r = await callEdge('save-linkedin-connection', {
          access_token: trimmedToken,
          ad_account_urn: urn,
          account_name: accountName.trim() || undefined,
          consent_given: true,
        })
        toast.success(r?.verified ? 'LinkedIn connected and verified.' : 'Saved (token could not be verified — assistant will surface auth errors).')
        setConnection({
          ad_account_urn: urn,
          account_name: r?.account_name ?? accountName.trim() ?? null,
          last_verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        setAccessToken('')
        setAdAccountId('')
        setAccountName('')
      } catch (err) {
        toast.error((err as Error).message)
      }
    })
  }

  function handleDisconnect() {
    if (!confirm('Remove the LinkedIn connection? The campaign assistant will stop seeing your ad metrics.')) return
    setDisconnecting(true)
    callEdge('delete-linkedin-connection')
      .then(() => { toast.success('Disconnected.'); setConnection(null) })
      .catch(err => toast.error((err as Error).message))
      .finally(() => setDisconnecting(false))
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#0A66C2]/10 flex items-center justify-center text-[#0A66C2]">
          <Globe className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-100">LinkedIn</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {connection
              ? 'Active · publish posts and query live ad metrics from the campaign Ask tab.'
              : 'Connect your company page to publish posts and pull live ad metrics into the campaign Ask tab.'}
          </p>
        </div>
      </div>

      {connection ? (
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="text-emerald-200 font-medium">Connected</div>
              {!isViewer && (
                <>
                  <div className="text-slate-400 mt-1">
                    Account: <span className="text-slate-200 font-mono text-xs">{connection.account_name ?? connection.ad_account_urn.split(':').pop() ?? 'Unknown'}</span>
                  </div>
                  {connection.last_verified_at && (
                    <div className="text-slate-500 text-xs mt-1">
                      Last verified {new Date(connection.last_verified_at).toLocaleString()}
                    </div>
                  )}
                  {connection.consent_given_at && (
                    <div className="text-slate-500 text-xs mt-0.5">
                      Terms accepted {new Date(connection.consent_given_at).toLocaleString()}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {!isViewer && (
            <Button onClick={handleDisconnect} variant="outline" disabled={disconnecting}
              className="border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200">
              {disconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Disconnect
            </Button>
          )}
        </div>
      ) : isViewer ? (
        <div className="p-5">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <Lock className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="text-slate-300 font-medium">Not connected</div>
              <div className="text-slate-500 text-xs mt-1">Available for members and above</div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="p-5 space-y-5">

          {/* Primary CTA — full guide */}
          <Link
            href="/settings/integrations/linkedin-setup"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3.5 rounded-xl border border-indigo-500/30 bg-indigo-950/40 hover:bg-indigo-950/60 px-4 py-3.5 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-4.5 h-4.5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-indigo-300 group-hover:text-indigo-200">How to Integrate LinkedIn with GTM Engine</div>
              <div className="text-xs text-slate-400 mt-0.5">Full step-by-step guide — app creation, scopes, token generation &amp; renewal</div>
            </div>
            <ExternalLink className="w-4 h-4 text-indigo-500 group-hover:text-indigo-400 shrink-0" />
          </Link>

          {/* 60-day token warning */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-600/30 bg-amber-950/30 px-3.5 py-3 text-xs text-amber-200/90">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-amber-200">LinkedIn tokens expire every 60 days.</strong>{' '}
              You will need to regenerate and repaste the token roughly every 2 months.
              We recommend setting a calendar reminder 55 days after connecting.
            </span>
          </div>

          {/* Org admin notice */}
          <div className="flex items-start gap-2.5 rounded-lg border border-[#0077B5]/30 bg-[#0077B5]/10 px-3.5 py-3 text-xs text-[#5db8e8]">
            <Building2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Use the account that administers your company page.</strong>{' '}
              GTM Engine operates at the <em>organisation</em> level only — no personal posts.
              Generate the token while signed in as a LinkedIn{' '}
              <strong className="text-white">Page Administrator</strong>, or posting and reading will not work.
            </span>
          </div>

          <div>
            <Label htmlFor="li-token" className="text-sm">LinkedIn Access Token</Label>
            <Input
              id="li-token"
              type="password"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
              placeholder="AQX..."
              className="mt-1.5 font-mono text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="li-acct" className="text-sm">Ad Account ID</Label>
              <Input
                id="li-acct"
                value={adAccountId}
                onChange={e => setAdAccountId(e.target.value.replace(/\D/g, ''))}
                placeholder="506795881"
                className="mt-1.5 font-mono"
                required
              />
              <p className="text-xs text-slate-500 mt-1">Digits only.</p>
            </div>
            <div>
              <Label htmlFor="li-name" className="text-sm">Display name <span className="text-slate-500">(optional)</span></Label>
              <Input
                id="li-name"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                placeholder="Qubitly EMEA"
                className="mt-1.5"
                maxLength={200}
              />
            </div>
          </div>

          <Button type="submit" disabled={pending || !allConsented} className="bg-[#0A66C2] hover:bg-[#0a5cb0] text-white disabled:opacity-40 disabled:cursor-not-allowed">
            {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
            Connect LinkedIn
          </Button>

          {/* Consent checkboxes — must all be ticked to enable the button */}
          <div className="border-t border-white/[0.06] pt-4 space-y-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Before connecting, please confirm:</p>
            {[
              {
                id: 'c1',
                checked: consent1,
                set: setConsent1,
                label: 'I am connecting a LinkedIn access token that belongs to me or that I am authorised to use on behalf of my organisation. I understand GTM Engine will use it to read ad metrics and publish posts to my company page.',
              },
              {
                id: 'c2',
                checked: consent2,
                set: setConsent2,
                label: 'I understand my token is encrypted at rest, never exposed to other organisations, and never used for any purpose other than operating this integration. I can disconnect at any time and the token will be permanently deleted.',
              },
              {
                id: 'c3',
                checked: consent3,
                set: setConsent3,
                label: 'I accept the GTM Engine Terms of Service and acknowledge that LinkedIn tokens expire every 60 days and must be renewed by me.',
              },
            ].map(({ id, checked, set, label }) => (
              <label key={id} className="flex items-start gap-3 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => set(v => !v)}
                  className={`mt-0.5 shrink-0 w-4 h-4 rounded border transition-colors ${
                    checked
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-600 group-hover:border-slate-500'
                  } flex items-center justify-center`}
                  aria-checked={checked}
                  role="checkbox"
                >
                  {checked && (
                    <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className="text-xs text-slate-400 leading-relaxed select-none">{label}</span>
              </label>
            ))}
          </div>
        </form>
      )}
    </div>
  )
}
