export interface SanityImageAsset {
  _ref?: string
}

export interface SanityImage {
  asset?: SanityImageAsset
  alt?: string
  caption?: string
}

export interface SanitySlug {
  current: string
}

// A portable-text block — kept as unknown[] to avoid importing @portabletext/types
export type PortableTextBlock = Record<string, unknown>

export interface SanityPost {
  _id: string
  _type: 'post'
  title: string
  slug: string // projected as slug.current in GROQ
  category?: string
  author?: string
  publishedAt?: string
  seoTitle?: string
  metaDescription?: string
  keywords?: string[]
  aiSummary?: string
  mainImage?: SanityImage
  body?: string
  richBody?: PortableTextBlock[]
}

export interface SanityPostCard
  extends Pick<SanityPost, '_id' | 'title' | 'slug' | 'category' | 'author' | 'publishedAt' | 'metaDescription' | 'body' | 'mainImage'> {}

export interface SanityFaq {
  _id: string
  question: string
  answer: string
  category?: string
  order?: number
}
