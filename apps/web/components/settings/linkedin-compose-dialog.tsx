'use client'

import { useState, useEffect, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2, X, ImageIcon, Building2, CheckCircle2, AlertCircle, Upload, Layers } from 'lucide-react'
import { LinkedinIcon } from '@/components/icons/linkedin-icon'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const MAX_CHARS = 3000

interface OrgOption {
  urn: string
  name: string
}

export interface LinkedInComposeAsset {
  jobId: string
  subject: string
  signedUrl: string // for preview only
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialAsset?: LinkedInComposeAsset | null
  onPosted?: () => void // e.g. refresh posts panel
}

export function LinkedInComposeDialog({ open, onOpenChange, initialAsset, onPosted }: Props) {
  const [text, setText] = useState('')
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [posting, setPosting] = useState(false)
  const [posted, setPosted] = useState(false)
  const [postUrl, setPostUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Asset picker state (used when no initialAsset prop is passed)
  const [showLibrary, setShowLibrary] = useState(false)
  const [libraryJobs, setLibraryJobs] = useState<{ id: string; signedUrl: string | null; subject: string }[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [pickedJobId, setPickedJobId] = useState<string | null>(null)
  const [pickedJobSignedUrl, setPickedJobSignedUrl] = useState<string | null>(null)
  const [pickedJobSubject, setPickedJobSubject] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadLibraryJobs() {
    setLibraryLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase
        .from('generation_jobs')
        .select('id, prompt_tags, output_url')
        .eq('asset_type', 'image')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(16)
      if (!data?.length) return
      const jobsWithUrls = await Promise.all(
        data.map(async (job) => {
          const path = (job.output_url as string)?.replace(/^assets\//, '')
          if (!path) return { id: job.id, signedUrl: null, subject: (job.prompt_tags as any)?.subject ?? 'Untitled' }
          const { data: signed } = await supabase.storage.from('assets').createSignedUrl(path, 3600)
          return { id: job.id, signedUrl: signed?.signedUrl ?? null, subject: (job.prompt_tags as any)?.subject ?? 'Untitled' }
        })
      )
      setLibraryJobs(jobsWithUrls)
    } catch {
      // non-fatal
    } finally {
      setLibraryLoading(false)
    }
  }

  // Fetch orgs when dialog opens
  useEffect(() => {
    if (!open) return
    setText('')
    setPosted(false)
    setPostUrl(null)
    setError(null)
    setShowLibrary(false)
    setLibraryJobs([])
    setPickedJobId(null)
    setPickedJobSignedUrl(null)
    setPickedJobSubject(null)
    setUploadFile(null)
    setUploadPreview(null)

    async function loadOrgs() {
      setLoadingOrgs(true)
      try {
        const supabase = getSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-linkedin-posts`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const json = await res.json()
        // Build org list from the posts response (we added orgName there)
        // Re-use the get-linkedin-posts endpoint and extract orgs from its internal data.
        // Since it doesn't return orgs list directly, call a separate approach:
        // Actually get-linkedin-posts returns { posts, memberName, orgName }
        // We need orgUrns. We'll fetch them via the function.
        // For now, we parse from the posts authorName to build a simple list.
        // Better: call get-linkedin-orgs or embed in get-linkedin-posts response.
        // We'll add orgList to get-linkedin-posts response via a quick patch below.
        const orgList: OrgOption[] = json.orgs ?? []
        if (orgList.length > 0) {
          setOrgs(orgList)
          setSelectedOrg(orgList[0].urn)
        }
      } catch {
        // non-fatal
      } finally {
        setLoadingOrgs(false)
      }
    }
    loadOrgs()
  }, [open])

  async function handlePost() {
    if (!selectedOrg || !text.trim()) return
    setPosting(true)
    setError(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')

      const body: Record<string, unknown> = {
        org_urn: selectedOrg,
        text: text.trim(),
      }

      // Determine asset: initialAsset prop > library pick > uploaded file
      const effectiveJobId = initialAsset?.jobId ?? pickedJobId

      let res: Response
      if (uploadFile) {
        // Send as multipart so the Edge Function receives raw image bytes
        const fd = new FormData()
        fd.append('org_urn', selectedOrg)
        fd.append('text', text.trim())
        fd.append('image', uploadFile)
        res = await fetch(`${SUPABASE_URL}/functions/v1/post-to-linkedin`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: fd,
        })
      } else {
        if (effectiveJobId) body.job_id = effectiveJobId
        res = await fetch(`${SUPABASE_URL}/functions/v1/post-to-linkedin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(body),
        })
      }

      const json = await res.json()
      if (!res.ok) {
        const msgMap: Record<string, string> = {
          not_connected: 'LinkedIn not connected. Reconnect in Settings → Integrations.',
          text_too_long: 'Post text exceeds 3,000 characters.',
          asset_not_ready: 'Asset is not ready yet. Wait for generation to complete.',
          only_images_supported: 'Only images can be attached to LinkedIn posts right now.',
          linkedin_post_failed: 'LinkedIn rejected the post. Try again or shorten your text.',
        }
        throw new Error(msgMap[json?.error] ?? json?.error ?? `Error ${res.status}`)
      }
      setPosted(true)
      setPostUrl(json.post_url ?? null)
      onPosted?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPosting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => { if (!posting) onOpenChange(false) }}
    >
      <div
        className="bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg space-y-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0077B5]/20 border border-[#0077B5]/40 flex items-center justify-center">
              <LinkedinIcon className="w-4 h-4 text-[#0077B5]" />
            </div>
            <h2 className="text-base font-semibold text-white">Post to LinkedIn</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            disabled={posting}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {posted ? (
          /* Success state */
          <div className="space-y-4 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-medium">Posted successfully!</p>
              <p className="text-slate-400 text-sm mt-1">Your post is now live on LinkedIn.</p>
            </div>
            {postUrl && (
              <a
                href={postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#0077B5] hover:text-[#0099e0] transition-colors"
              >
                View post on LinkedIn →
              </a>
            )}
            <Button
              className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            {/* Org selector */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Post as</label>
              {loadingOrgs ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your pages…
                </div>
              ) : orgs.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-sm text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  No company pages found. Make sure LinkedIn is connected in Settings → Integrations.
                </div>
              ) : orgs.length === 1 ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                  <Building2 className="w-4 h-4 text-[#0077B5] shrink-0" />
                  <span className="text-sm text-slate-200">{orgs[0].name}</span>
                </div>
              ) : (
                <select
                  value={selectedOrg}
                  onChange={e => setSelectedOrg(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0077B5]"
                >
                  {orgs.map(o => (
                    <option key={o.urn} value={o.urn}>{o.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Asset preview — from prop */}
            {initialAsset && (
              <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                <div className="w-14 h-14 rounded-md overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center">
                  <img
                    src={initialAsset.signedUrl}
                    alt={initialAsset.subject}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <ImageIcon className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400">Image attached</span>
                  </div>
                  <p className="text-sm text-slate-200 truncate">{initialAsset.subject}</p>
                </div>
              </div>
            )}

            {/* Asset picker — only when no initialAsset was passed in */}
            {!initialAsset && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400 font-medium">Attach image (optional)</label>
                  {(pickedJobId || uploadFile) && (
                    <button
                      type="button"
                      onClick={() => { setPickedJobId(null); setPickedJobSignedUrl(null); setPickedJobSubject(null); setUploadFile(null); setUploadPreview(null) }}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Selected asset preview */}
                {pickedJobId && pickedJobSignedUrl && (
                  <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                    <img src={pickedJobSignedUrl} alt={pickedJobSubject ?? ''} className="w-14 h-14 rounded-md object-cover shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs text-slate-400">From library</span>
                      <p className="text-sm text-slate-200 truncate">{pickedJobSubject}</p>
                    </div>
                  </div>
                )}
                {uploadFile && uploadPreview && (
                  <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                    <img src={uploadPreview} alt={uploadFile.name} className="w-14 h-14 rounded-md object-cover shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs text-slate-400">Uploaded</span>
                      <p className="text-sm text-slate-200 truncate">{uploadFile.name}</p>
                    </div>
                  </div>
                )}

                {/* Picker buttons (hidden once an asset is chosen) */}
                {!pickedJobId && !uploadFile && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowLibrary(v => !v); if (!libraryJobs.length) loadLibraryJobs() }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      From Library
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload image
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setShowLibrary(false)
                        setUploadFile(file)
                        setUploadPreview(URL.createObjectURL(file))
                        e.target.value = ''
                      }}
                    />
                  </div>
                )}

                {/* Library mini-grid */}
                {showLibrary && !pickedJobId && (
                  <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                    {libraryLoading ? (
                      <div className="flex items-center gap-2 text-slate-500 text-xs py-3 justify-center">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading library…
                      </div>
                    ) : libraryJobs.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-3">No completed images in your library yet.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                        {libraryJobs.map(job => (
                          <button
                            key={job.id}
                            type="button"
                            title={job.subject}
                            onClick={() => { setPickedJobId(job.id); setPickedJobSignedUrl(job.signedUrl); setPickedJobSubject(job.subject); setShowLibrary(false) }}
                            className="aspect-square rounded-md overflow-hidden border border-slate-700 hover:border-[#0077B5] transition-colors"
                          >
                            {job.signedUrl ? (
                              <img src={job.signedUrl} alt={job.subject} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-slate-600" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Text area */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Post text</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="What do you want to share with your LinkedIn audience?"
                rows={5}
                maxLength={MAX_CHARS}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-[#0077B5] focus:border-[#0077B5]"
              />
              <div className={`text-xs text-right tabular-nums ${text.length > MAX_CHARS * 0.9 ? 'text-amber-400' : 'text-slate-500'}`}>
                {text.length} / {MAX_CHARS}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-2.5 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="ghost"
                className="flex-1 border border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => onOpenChange(false)}
                disabled={posting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#0077B5] hover:bg-[#0099e0] text-white font-medium"
                onClick={handlePost}
                disabled={posting || !selectedOrg || !text.trim() || orgs.length === 0}
              >
                {posting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Posting…</>
                ) : (
                  <><LinkedinIcon className="w-4 h-4 mr-2" /> Post now</>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
