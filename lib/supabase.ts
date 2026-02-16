import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

/**
 * Server-side Supabase client. Returns null if env vars are missing
 * (allows graceful fallback to live Figma API calls).
 */
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  _client = createClient(url, key)
  return _client
}

export function hasSupabase(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
}

// ── Types matching the database schema ───────────────────────────

export interface DbCommentFile {
  file_key: string
  file_name: string
  last_synced_at: string
  total_comments: number
}

export interface DbComment {
  id: string
  file_key: string
  page_id: string
  page_name: string
  node_id: string | null
  node_name: string
  parent_id: string | null
  order_number: number | null
  author: string
  author_avatar: string
  message: string
  created_at: string
  resolved_at: string | null
  thread_depth: number
  reply_count: number
}

export interface DbCommentSummary {
  id?: string
  file_key: string
  node_id: string
  summary: string
  comment_count: number
  generated_at: string
}
