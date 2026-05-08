import type { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { sanityClient, urlForImage } from '@/lib/sanity/client'
import type { SanityPostCard } from '@/lib/sanity/types'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'AI-powered go-to-market insights for B2B teams — campaign strategy, ICP enrichment, LinkedIn automation, and AI creative production from the Qubitly Ventures team.',
  openGraph: {
    title: 'GTM Engine Blog',
    description: 'AI go-to-market insights for B2B marketing and sales teams.',
    url: 'https://gtmengine.qubitlyventures.com/blog',
    type: 'website',
  },
  alternates: {
    canonical: 'https://gtmengine.qubitlyventures.com/blog',
  },
}

const POSTS_QUERY = `
  *[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
    _id,
    title,
    "slug": slug.current,
    category,
    author,
    publishedAt,
    metaDescription,
    body,
    mainImage { asset { _ref }, alt }
  }
`

export default async function BlogPage() {
  const posts = await sanityClient.fetch<SanityPostCard[]>(
    POSTS_QUERY,
    {},
    { next: { revalidate: 3600 } },
  )

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      {/* Hero */}
      <div className="mb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 mb-4 tracking-tight">
          GTM Engine Blog
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          AI-powered go-to-market insights for B2B teams.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-24 bg-slate-900 rounded-2xl border border-slate-800">
          <p className="text-4xl mb-4">⚡</p>
          <p className="text-slate-400 text-lg font-medium mb-2">Insights coming soon</p>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            We&apos;re preparing articles on AI-powered B2B marketing, ICP enrichment, and campaign
            strategy. Check back soon.
          </p>
          <Link
            href="/signup"
            className="inline-block mt-6 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg transition-colors font-medium"
          >
            Try GTM Engine free
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}

function PostCard({ post }: { post: SanityPostCard }) {
  const imageUrl = urlForImage(post.mainImage, { width: 800, height: 450 })
  const excerpt =
    post.metaDescription || (post.body ? post.body.slice(0, 150) + '…' : null)

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/50"
    >
      {/* Cover image */}
      {imageUrl ? (
        <div className="aspect-video overflow-hidden bg-slate-800">
          <img
            src={imageUrl}
            alt={post.mainImage?.alt || post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
          <span className="text-4xl opacity-30">⚡</span>
        </div>
      )}

      <div className="p-6">
        {post.category && (
          <span className="inline-block text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-3">
            {post.category}
          </span>
        )}
        <h2 className="text-base font-semibold text-slate-100 mb-2 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
          {post.title}
        </h2>
        {excerpt && (
          <p className="text-sm text-slate-400 line-clamp-3 mb-4 leading-relaxed">{excerpt}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {post.author && <span className="text-slate-400">{post.author}</span>}
          {post.author && post.publishedAt && <span>·</span>}
          {post.publishedAt && (
            <span>{format(new Date(post.publishedAt), 'MMM d, yyyy')}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
