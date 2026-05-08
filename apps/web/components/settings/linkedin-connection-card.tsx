'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Globe, ShieldCheck, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

interface ExistingConnection {
  ad_account_urn: string
  account_name: string | null
  last_verified_at: string
  created_at: string
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
  const [pending, startTransition] = useTransition()
  const [disconnecting, setDisconnecting] = useState(false)

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
          <h2 className="text-base font-semibold text-slate-100">LinkedIn Ads</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Lets the campaign assistant pull your live ad metrics (impressions, clicks, spend, conversions) for the last 14 days.
          </p>
        </div>
      </div>

      {connection ? (
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="text-emerald-200 font-medium">Connected</div>
              <div className="text-slate-400 mt-1">
                Account: <span className="text-slate-200 font-mono text-xs">{connection.account_name ?? connection.ad_account_urn.split(':').pop() ?? 'Unknown'}</span>
              </div>
              {connection.last_verified_at && (
                <div className="text-slate-500 text-xs mt-1">
                  Last verified {new Date(connection.last_verified_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
          <Button onClick={handleDisconnect} variant="outline" disabled={disconnecting}
            className="border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200">
            {disconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Disconnect
          </Button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="p-5 space-y-5">
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs text-amber-100/80 leading-relaxed">
            <strong className="text-amber-200">How to get a token (60-day, paste-once):</strong>
            <ol className="mt-2 ml-4 list-decimal space-y-1">
              <li>Visit the <a className="underline hover:text-amber-100 inline-flex items-center gap-0.5" href="https://www.linkedin.com/developers/tools/oauth/token-generator" target="_blank" rel="noopener noreferrer">LinkedIn Token Generator <ExternalLink className="w-3 h-3" /></a> (you must already have a developer app).</li>
              <li>Select scopes: <code className="text-amber-200">r_ads</code> and <code className="text-amber-200">r_ads_reporting</code>.</li>
              <li>Copy the generated token and paste below.</li>
              <li>Find your Ad Account ID in <a className="underline hover:text-amber-100" href="https://www.linkedin.com/campaignmanager/" target="_blank" rel="noopener noreferrer">Campaign Manager</a> URL (the digits after <code>/accounts/</code>).</li>
            </ol>
            <p className="mt-2 text-amber-100/60">Token is encrypted (AES-256-GCM) and never returned to the browser after saving.</p>
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

          <Button type="submit" disabled={pending} className="bg-[#0A66C2] hover:bg-[#0a5cb0] text-white">
            {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
            Connect LinkedIn
          </Button>
        </form>
      )}
    </div>
  )
}
