'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from './supabase-auth.js'

export type UserRole = 'admin' | 'user'

const STORAGE_KEY = 'heimdall:user-role'

/**
 * Reads role from Supabase user_metadata.role.
 * Falls back to 'user' when no Supabase session exists (e.g. cookie-only sheet auth).
 */
export function useUserRole(): UserRole {
  const [role, setRole] = useState<UserRole>(() => {
    if (typeof window === 'undefined') return 'user'
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'admin' || stored === 'user') return stored
    } catch {
      // ignore
    }
    return 'user'
  })

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) {
      setRole('user')
      return
    }
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        setRole('user')
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          // ignore
        }
        return
      }
      const raw = user.user_metadata?.role
      const resolved: UserRole = raw === 'admin' ? 'admin' : 'user'
      setRole(resolved)
      try {
        localStorage.setItem(STORAGE_KEY, resolved)
      } catch {
        // ignore
      }
    })
  }, [])

  return role
}
