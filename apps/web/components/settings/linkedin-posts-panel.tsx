'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { RefreshCw, ExternalLink, Image, Video, FileText, User, Building2, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

interface LiPost {
  id: string
  text: string
  publishedAt: string | null
  type: 'personal' | 'org'
  authorName: string
  mediaType: string | null
  postUrl: string
}

function MediaIcon({ mediaType }: { mediaType: string | null }) {
  if (mediaType === 'IMAGE') return <Image className="h-3.5 w-3.5 text-slate-400" />
  if (mediaType === 'VIDEO') return <Video className="h-3.5 w-3.5 text-slate-400" />
  if (mediaType === 'ARTICLE') return <FileText className="h-3.5 w-3.5 text-slate-400" />
  return null
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function LinkedInPostsPanel() {
  const [posts, setPosts] = useState<LiPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [memberName, setMemberName] = useState('')
  const [orgName, setOrgName] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)

  async function fetchPosts() {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-linkedin-posts`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) {
        // Not connected — silently hide the panel
        if (res.status === 404) { setNotConnected(true); setLoading(false); return }
        throw new Error(json?.error === 'linkedin_auth_failed'
          ? 'LinkedIn token expired. Reconnect in the LinkedIn Ads section above.'
          : (json?.error ?? `Error ${res.status}`))
      }
      setPosts(json.posts ?? [])
      setMemberName(json.memberName ?? '')
      setOrgName(json.orgName ?? null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPosts() }, [])

  if (notConnected) return null

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Recent LinkedIn Posts</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {orgName
              ? `${memberName} · ${orgName}`
              : memberName || 'Your posts'}
            {' · last 10 per author'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchPosts}
          disabled={loading}
          className="text-slate-400 hover:text-white h-8 w-8 p-0"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Body */}
      {loading && (
        <div className="flex items-center gap-2 py-6 justify-center text-slate-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading posts…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-900/20 border border-red-700/40 px-3 py-2.5 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-6">No posts found. Start posting on LinkedIn to see them here.</p>
      )}

      {!loading && !error && posts.length > 0 && (
        <ul className="space-y-3">
          {posts.map(post => (
            <li key={post.id} className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3 space-y-2">
              {/* Author + meta row */}
              <div className="flex items-center gap-2 flex-wrap">
                {post.type === 'personal'
                  ? <User className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                  : <Building2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                }
                <span className="text-xs font-medium text-slate-300">{post.authorName}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 border ${
                    post.type === 'personal'
                      ? 'border-teal-700/50 text-teal-400'
                      : 'border-blue-700/50 text-blue-400'
                  }`}
                >
                  {post.type === 'personal' ? 'Personal' : 'Company'}
                </Badge>
                <MediaIcon mediaType={post.mediaType} />
                {post.publishedAt && (
                  <span className="text-xs text-slate-500 ml-auto">{relativeTime(post.publishedAt)}</span>
                )}
              </div>

              {/* Post text */}
              <p className="text-sm text-slate-300 leading-relaxed line-clamp-4 whitespace-pre-line">
                {post.text || <span className="text-slate-500 italic">(no text content)</span>}
              </p>

              {/* View link */}
              <a
                href={post.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
              >
                View on LinkedIn <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
