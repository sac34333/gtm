'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function CreateOrgPage() {
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)

    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.functions.invoke('create-org', {
      body: { name: orgName.trim() },
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
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Create your organisation</CardTitle>
          <CardDescription>Give your workspace a name to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organisation name</Label>
              <Input
                id="org-name"
                type="text"
                placeholder="Acme Corp"
                required
                maxLength={80}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !orgName.trim()}>
              {loading ? 'Creating…' : 'Create organisation'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
