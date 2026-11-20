import { createBrowserClient } from '@supabase/ssr'

type BrowserClient = ReturnType<typeof createBrowserClient>

let client: BrowserClient | null = null

/** Browser Supabase client, created on first use (never at import time, so builds don't need secrets). */
export function createClient(): BrowserClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}

/** Lazily-initialised singleton; existing `supabase.xyz` call sites keep working. */
export const supabase = new Proxy({} as BrowserClient, {
  get(_target, prop) {
    const real = createClient() as any
    const value = real[prop]
    return typeof value === 'function' ? value.bind(real) : value
  },
})
