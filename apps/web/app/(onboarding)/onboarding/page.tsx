'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    company_name: '',
    one_sentence_pitch: '',
    website_url: '',
    industry_sector: '',
    primary_platform: 'linkedin',
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.functions.invoke('save-onboarding', {
      body: form,
    })

    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? 'Failed to save')
      setLoading(false)
      return
    }

    toast.success('Setup complete!')
    router.replace('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Set up your brand</CardTitle>
          <CardDescription>Tell us about your company so we can personalise your GTM content</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company name</Label>
              <Input
                id="company_name"
                required
                maxLength={120}
                value={form.company_name}
                onChange={(e) => update('company_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="one_sentence_pitch">One-sentence pitch</Label>
              <Textarea
                id="one_sentence_pitch"
                required
                maxLength={300}
                rows={2}
                placeholder="We help B2B SaaS teams automate their go-to-market motion with AI."
                value={form.one_sentence_pitch}
                onChange={(e) => update('one_sentence_pitch', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website_url">Website URL</Label>
              <Input
                id="website_url"
                type="url"
                placeholder="https://acmecorp.com"
                value={form.website_url}
                onChange={(e) => update('website_url', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry_sector">Industry</Label>
              <Input
                id="industry_sector"
                placeholder="B2B SaaS"
                maxLength={80}
                value={form.industry_sector}
                onChange={(e) => update('industry_sector', e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !form.company_name || !form.one_sentence_pitch}>
              {loading ? 'Saving…' : 'Complete setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
