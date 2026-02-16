/**
 * Supabase auth client factories for Heimdall.
 *
 * Uses @supabase/ssr for cookie-based session management.
 * The existing lib/supabase.ts (service key client) stays separate.
 *
 * NOTE: Middleware client is created inline in middleware.ts because
 * it needs NextRequest/NextResponse types from the Next.js app context.
 */

import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'

/**
 * Check if Supabase Auth is configured (public keys available client-side).
 */
export function hasSupabaseAuth(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/**
 * Browser client for use in client components.
 * Automatically manages session cookies via document.cookie.
 * Returns null if Supabase is not configured.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createBrowserClient(url, key)
}

/**
 * Server client for use in API route handlers.
 * Reads cookies from the request headers to identify the user.
 */
export function createSupabaseRouteClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { supabase: null }

  const cookieHeader = request.headers.get('cookie') ?? ''
  const cookies = cookieHeader.split(';').map((c) => {
    const [name, ...rest] = c.trim().split('=')
    return { name, value: rest.join('=') }
  }).filter((c) => c.name)

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookies
      },
      setAll() {
        // Route handlers don't need to set cookies for read-only auth checks
      },
    },
  })

  return { supabase }
}
