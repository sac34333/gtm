import { createClient } from '@sanity/client'

export const PROJECT_ID = 'vjjmvlf6'
export const DATASET = 'production'
export const API_VERSION = '2026-05-08'

export const sanityClient = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  useCdn: true,
  perspective: 'published',
  stega: false,
})

/**
 * Build a Sanity CDN image URL from an image field.
 * Supports optional width/height crop transforms.
 *
 * Sanity asset ref format: `image-{assetId}-{origW}x{origH}-{ext}`
 * CDN URL format:          `https://cdn.sanity.io/images/{projectId}/{dataset}/{assetId}-{origW}x{origH}.{ext}?w=...`
 */
export function urlForImage(
  image: { asset?: { _ref?: string } } | undefined | null,
  { width = 800, height = 450 }: { width?: number; height?: number } = {},
): string | null {
  const ref = image?.asset?._ref
  if (!ref) return null
  const match = ref.match(/^image-([a-zA-Z0-9]+)-(\d+x\d+)-(\w+)$/)
  if (!match) return null
  const [, assetId, dimensions, ext] = match
  return `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${assetId}-${dimensions}.${ext}?w=${width}&h=${height}&fit=crop&auto=format`
}
