'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/layout/auth-shell'
import { Loader2 } from 'lucide-react'

export default function CreateOrgPage() {
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)

    // Derive slug: lowercase, a-z 0-9, hyphens, 3-30 chars
    const baseSlug = orgName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24)
    const slug = (baseSlug.length >= 3 ? baseSlug : `org-${baseSlug}`)
      + '-' + Math.random().toString(36).slice(2, 7)

    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.functions.invoke('create-org', {
      body: { name: orgName.trim(), slug },
    })

    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? 'Failed to create org')
      setLoading(false)
      return
    }

    // Refresh session to pick up updated app_metadata.org_id
    await supabase.auth.refreshSession()
    toast.success('Organisation created!')
    router.replace('/onboarding')
  }

  return (
    <AuthShell eyebrow="Get started">
      <Card className="w-full bg-white/[0.04] backdrop-blur-xl border-white/[0.08] shadow-glass-lg">
        <CardHeader className="space-y-1.5 pb-4">
          <CardTitle className="text-2xl gtm-title">Create your organisation</CardTitle>
          <CardDescription className="text-slate-400">Give your workspace a name to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name" className="text-slate-300">Organisation name</Label>
              <Input
                id="org-name"
                type="text"
                placeholder="Acme Corp"
                required
                maxLength={80}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="bg-slate-950/60 border-slate-700 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <Button type="submit" className="w-full bg-indigo-600 text-white font-medium" disabled={loading || !orgName.trim()}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : 'Create organisation'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
