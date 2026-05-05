'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, FileText, ImageIcon, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

type Kind = 'logo' | 'pdf'

const ACCEPT: Record<Kind, string> = {
  logo: 'image/png,image/jpeg,image/svg+xml,image/webp',
  pdf: 'application/pdf',
}

const MAX_BYTES: Record<Kind, number> = {
  logo: 5 * 1024 * 1024,   // 5 MB
  pdf: 25 * 1024 * 1024,   // 25 MB
}

export function BrandFileUpload({
  kind,
  label,
  description,
  currentPath,
  currentSignedUrl,
  onUploaded,
}: {
  kind: Kind
  label: string
  description: string
  currentPath?: string | null
  currentSignedUrl?: string | null
  onUploaded: (path: string) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string>('')

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES[kind]) {
      toast.error(`File too large (max ${MAX_BYTES[kind] / (1024 * 1024)} MB)`)
      return
    }

    setBusy(true)
    setProgress('Preparing upload…')

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not signed in')

      // Sanitise filename — replace spaces/non-alphanumeric (keep dot)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
      const stamped = `${Date.now()}_${safeName}`

      // 1. Get a signed upload URL
      setProgress('Requesting upload URL…')
      const urlRes = await fetch(`${SUPABASE_URL}/functions/v1/get-upload-url`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: 'brands',
          path: stamped,
          content_type: file.type,
        }),
      })
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}))
        throw new Error(err?.error ?? 'Could not get upload URL')
      }
      const { path, token: uploadToken } = await urlRes.json()

      // 2. Upload to the signed URL
      setProgress('Uploading…')
      const { error: uploadError } = await supabase
        .storage
        .from('brands')
        .uploadToSignedUrl(path, uploadToken, file, { contentType: file.type, upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      // 3. Persist the path to brand_contexts via save-onboarding
      setProgress('Saving…')
      await onUploaded(path)

      toast.success(kind === 'logo' ? 'Logo uploaded' : 'Brand guidelines uploaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      setProgress('')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove this ${kind === 'logo' ? 'logo' : 'PDF'}?`)) return
    setBusy(true)
    try {
      // Save empty string to clear the field
      await onUploaded('')
      toast.success('Removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  const Icon = kind === 'logo' ? ImageIcon : FileText

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-slate-300">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>

      {currentPath ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/40">
          {kind === 'logo' && currentSignedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentSignedUrl} alt="Logo" className="h-12 w-12 object-contain rounded bg-white/5 p-1" />
          ) : (
            <Icon className="w-8 h-8 text-indigo-400 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate">{currentPath.split('/').pop()}</p>
            {currentSignedUrl && (
              <a
                href={currentSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            Replace
          </Button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="text-slate-500 hover:text-red-400 p-1"
            aria-label="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 hover:border-indigo-500 hover:bg-slate-900/60 transition disabled:opacity-50"
        >
          <Upload className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-300">
            {busy ? progress || 'Working…' : `Upload ${kind === 'logo' ? 'logo' : 'PDF'}`}
          </span>
          <span className="text-xs text-slate-500">
            {kind === 'logo' ? 'PNG, JPG, SVG, WebP — max 5 MB' : 'PDF — max 25 MB'}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
    </div>
  )
}
