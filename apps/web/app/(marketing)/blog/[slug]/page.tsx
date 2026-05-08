import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { sanityClient, urlForImage } from '@/lib/sanity/client'
import type { SanityPost } from '@/lib/sanity/types'
import { PortableTextRenderer } from '@/components/blog/portable-text'

export const runtime = 'edge'

const POST_QUERY = `
  *[_type == "post" && slug.current == $slug && defined(slug.current)][0] {
    _id,
    title,
    "slug": slug.current,
    category,
    author,
    publishedAt,
    seoTitle,
    metaDescription,
    keywords,
    aiSummary,
    mainImage { asset { _ref }, alt },
    body,
    richBody
  }
`

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const post = await sanityClient.fetch<SanityPost | null>(
    POST_QUERY,
    { slug: params.slug },
    { next: { revalidate: 3600 } },
  )
  if (!post) return { title: 'Post Not Found' }

  const imageUrl = urlForImage(post.mainImage, { width: 1200, height: 630 })

  return {
    title: post.seoTitle || post.title,
    description: post.metaDescription,
    keywords: post.keywords,
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.metaDescription,
      type: 'article',
      url: `https://gtmengine.qubitlyventures.com/blog/${post.slug}`,
      ...(post.publishedAt && { publishedTime: post.publishedAt }),
      ...(post.author && { authors: [post.author] }),
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: post.mainImage?.alt || post.title }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seoTitle || post.title,
      description: post.metaDescription,
      ...(imageUrl && { images: [imageUrl] }),
    },
    alternates: {
      canonical: `https://gtmengine.qubitlyventures.com/blog/${post.slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await sanityClient.fetch<SanityPost | null>(
    POST_QUERY,
    { slug: params.slug },
    { next: { revalidate: 3600 } },
  )
  if (!post) notFound()

  const imageUrl = urlForImage(post.mainImage, { width: 1200, height: 630 })

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription,
    ...(imageUrl && { image: imageUrl }),
    author: {
      '@type': 'Person',
      name: post.author || 'Qubitly Ventures',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Qubitly Ventures',
      url: 'https://qubitlyventures.com',
    },
    ...(post.publishedAt && { datePublished: post.publishedAt }),
    url: `https://gtmengine.qubitlyventures.com/blog/${post.slug}`,
    ...(post.keywords?.length && { keywords: post.keywords.join(', ') }),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Back */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors mb-10"
        >
          <span>←</span>
          <span>Back to blog</span>
        </Link>

        {/* Post header */}
        <header className="mb-8">
          {post.category && (
            <span className="inline-block text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-4">
              {post.category}
            </span>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4 leading-tight tracking-tight">
            {post.title}
          </h1>
          {post.metaDescription && (
            <p className="text-xl text-slate-400 mb-6 leading-relaxed">{post.metaDescription}</p>
          )}
          <div className="flex items-center gap-3 text-sm pb-6 border-b border-slate-800">
            {post.author && (
              <span className="text-slate-300 font-medium">{post.author}</span>
            )}
            {post.author && post.publishedAt && (
              <span className="text-slate-600">·</span>
            )}
            {post.publishedAt && (
              <span className="text-slate-500">
                {format(new Date(post.publishedAt), 'MMMM d, yyyy')}
              </span>
            )}
          </div>
        </header>

        {/* Cover image */}
        {imageUrl && (
          <div className="aspect-video rounded-xl overflow-hidden bg-slate-800 mb-10">
            <img
              src={imageUrl}
              alt={post.mainImage?.alt || post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Article body */}
        <article>
          {post.richBody && post.richBody.length > 0 ? (
            <PortableTextRenderer value={post.richBody} />
          ) : post.body ? (
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{post.body}</p>
          ) : null}
        </article>

        {/* AI Summary — machine-readable, lightly styled */}
        {post.aiSummary && (
          <aside className="mt-12 p-5 bg-slate-900 border border-slate-700/50 rounded-xl">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Summary
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">{post.aiSummary}</p>
          </aside>
        )}

        {/* CTA */}
        <div className="mt-16 p-8 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-center">
          <p className="text-lg font-semibold text-slate-100 mb-2">
            Ready to run AI-powered campaigns?
          </p>
          <p className="text-sm text-slate-400 mb-5">
            GTM Engine gives B2B teams a complete go-to-market workspace in one platform.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Get started free
          </Link>
        </div>
      </div>
    </>
  )
}
