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
  let posts: SanityPostCard[] = []
  try {
    posts = await sanityClient.fetch<SanityPostCard[]>(
      POSTS_QUERY,
      {},
      { next: { revalidate: 3600 } },
    )
  } catch {
    // Sanity unreachable — show empty state
  }

  const [featured, ...rest] = posts

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      {/* Hero */}
      <div className="mb-14">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 mb-4 tracking-tight">
          Insights &amp; Strategy.
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl leading-relaxed">
          AI-powered go-to-market playbooks for B2B marketing and sales teams.
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
        <>
          {/* Featured post — large two-column card */}
          {featured && <FeaturedCard post={featured} />}

          {/* Remaining posts — 3-column grid */}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
              {rest.map((post) => (
                <PostCard key={post._id} post={post} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Featured large card ─── */
function FeaturedCard({ post }: { post: SanityPostCard }) {
  const imageUrl = urlForImage(post.mainImage, { width: 1200, height: 630 })
  const excerpt = post.metaDescription || (post.body ? post.body.slice(0, 200) + '…' : null)

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all duration-200 hover:shadow-xl hover:shadow-slate-900/60"
    >
      <div className="md:grid md:grid-cols-2">
        {/* Image panel */}
        <div className="aspect-video md:aspect-auto md:min-h-[280px] overflow-hidden relative bg-gradient-to-br from-indigo-900/40 via-slate-800 to-slate-900">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={post.mainImage?.alt || post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="eager"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <span className="text-6xl opacity-10">⚡</span>
              <div className="flex flex-col gap-2 w-1/2">
                <div className="h-1.5 rounded-full bg-indigo-500/30 w-full" />
                <div className="h-1.5 rounded-full bg-violet-500/20 w-3/4" />
                <div className="h-1.5 rounded-full bg-blue-500/20 w-1/2" />
              </div>
            </div>
          )}
        </div>

        {/* Content panel */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          {post.category && (
            <span className="inline-block text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-5 self-start tracking-widest uppercase">
              {post.category}
            </span>
          )}
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-4 group-hover:text-indigo-300 transition-colors leading-snug">
            {post.title}
          </h2>
          {excerpt && (
            <p className="text-sm text-slate-400 mb-6 leading-relaxed line-clamp-4">{excerpt}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
            {post.author && <span className="text-slate-400 font-medium">{post.author}</span>}
            {post.author && post.publishedAt && <span>·</span>}
            {post.publishedAt && (
              <span>{format(new Date(post.publishedAt), 'MMM d, yyyy')}</span>
            )}
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 group-hover:gap-3 transition-all duration-200">
            Read article <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  )
}

/* ─── Standard post card ─── */
function PostCard({ post }: { post: SanityPostCard }) {
  const imageUrl = urlForImage(post.mainImage, { width: 800, height: 450 })
  const excerpt = post.metaDescription || (post.body ? post.body.slice(0, 140) + '…' : null)

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/50"
    >
      {/* Cover image */}
      <div className="aspect-video overflow-hidden relative bg-gradient-to-br from-indigo-900/30 via-slate-800 to-slate-900 shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={post.mainImage?.alt || post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="text-4xl opacity-10">⚡</span>
            <div className="flex flex-col gap-1.5 w-1/2">
              <div className="h-1 rounded-full bg-indigo-500/30 w-full" />
              <div className="h-1 rounded-full bg-violet-500/20 w-3/4" />
              <div className="h-1 rounded-full bg-blue-500/20 w-1/2" />
            </div>
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        {post.category && (
          <span className="inline-block text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-3 self-start tracking-widest uppercase">
            {post.category}
          </span>
        )}
        <h2 className="text-base font-semibold text-slate-100 mb-2 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
          {post.title}
        </h2>
        {excerpt && (
          <p className="text-sm text-slate-400 line-clamp-3 mb-4 leading-relaxed flex-1">{excerpt}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {post.author && <span className="text-slate-400 font-medium">{post.author}</span>}
            {post.author && post.publishedAt && <span>·</span>}
            {post.publishedAt && (
              <span>{format(new Date(post.publishedAt), 'MMM d, yyyy')}</span>
            )}
          </div>
          <span className="text-xs text-indigo-500 group-hover:text-indigo-400 transition-colors font-medium">
            Read →
          </span>
        </div>
      </div>
    </Link>
  )
}
