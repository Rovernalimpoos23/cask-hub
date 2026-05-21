// src/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

// createBrowserClient is a singleton under the hood — safe to call per-component
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
