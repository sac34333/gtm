/**
 * Shared Signal type for all source adapters.
 * Maps to the signals table columns.
 */
export interface Signal {
  headline: string
  url: string
  summary?: string
  source_name?: string
  source_type: string
  published_at?: string
  author?: string
  tags?: string[]
}
