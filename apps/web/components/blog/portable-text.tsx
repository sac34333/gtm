'use client'

import { PortableText, type PortableTextComponents } from '@portabletext/react'
import type { PortableTextBlock } from '@/lib/sanity/types'
import { urlForImage } from '@/lib/sanity/client'

const components: PortableTextComponents = {
  block: {
    h2: ({ children }) => (
      <h2 className="text-2xl font-bold text-slate-100 mt-10 mb-4 leading-tight">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xl font-semibold text-slate-100 mt-8 mb-3 leading-snug">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-lg font-medium text-slate-200 mt-6 mb-2">{children}</h4>
    ),
    normal: ({ children }) => (
      <p className="text-slate-300 leading-relaxed mb-5">{children}</p>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-indigo-500 pl-5 my-6 italic text-slate-400">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc list-outside pl-6 space-y-2 mb-5 text-slate-300">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal list-outside pl-6 space-y-2 mb-5 text-slate-300">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="leading-relaxed">{children}</li>,
    number: ({ children }) => <li className="leading-relaxed">{children}</li>,
  },
  marks: {
    strong: ({ children }) => (
      <strong className="text-slate-100 font-semibold">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
    code: ({ children }) => (
      <code className="text-indigo-300 bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    ),
    underline: ({ children }) => <span className="underline">{children}</span>,
    'strike-through': ({ children }) => <del className="text-slate-500">{children}</del>,
    link: ({ value, children }) => {
      const href = value?.href as string | undefined
      const isExternal = href?.startsWith('http')
      return (
        <a
          href={href}
          className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {children}
        </a>
      )
    },
  },
  types: {
    image: ({ value }) => {
      const imageUrl = urlForImage(value as { asset?: { _ref?: string } }, { width: 1200, height: 675 })
      if (!imageUrl) return null
      return (
        <figure className="my-8">
          <img
            src={imageUrl}
            alt={(value as { alt?: string }).alt || ''}
            className="w-full rounded-xl border border-slate-800"
            loading="lazy"
          />
          {(value as { caption?: string }).caption && (
            <figcaption className="text-center text-sm text-slate-500 mt-2">
              {(value as { caption?: string }).caption}
            </figcaption>
          )}
        </figure>
      )
    },
  },
}

export function PortableTextRenderer({ value }: { value: PortableTextBlock[] }) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <PortableText value={value as any} components={components} />
  )
}
