import { createBrowserClient } from '@supabase/ssr'
import { type Database } from './types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabaseBrowserClient() {
  if (client) return client
  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return client
}

// Singleton export for use in client components
export const supabase = getSupabaseBrowserClient()
