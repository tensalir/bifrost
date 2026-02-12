/**
 * Monday.com API client for Bifrost.
 * Webhook payload types and optional GraphQL for item/column fetch.
 */

const MONDAY_API_URL = 'https://api.monday.com/v2'

export interface MondayColumnValue {
  id: string
  title?: string
  text?: string
  value?: string
  type?: string
}

export interface MondayItem {
  id: string
  name: string
  created_at?: string
  column_values?: MondayColumnValue[]
}

function getMondayToken(): string | null {
  return process.env.MONDAY_API_TOKEN ?? null
}

/**
 * Run GraphQL query. Returns null if token missing.
 */
export async function mondayGraphql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T | null> {
  const token = getMondayToken()
  if (!token) return null
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': '2025-04',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Monday API error: ${res.status} ${res.statusText}`)
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (json.errors?.length) throw new Error(`Monday API: ${json.errors.map((e) => e.message).join('; ')}`)
  return json.data ?? null
}

/** Column map: title lowercase, spaces -> underscores */
export function columnMap(item: MondayItem): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {}
  for (const col of item.column_values ?? []) {
    const key = col.title ? col.title.toLowerCase().replace(/\s+/g, '_') : col.id
    const text = col.text != null ? String(col.text).trim() : ''
    if (text !== '') out[key] = text
    else if (col.value != null) {
      try {
        const parsed = JSON.parse(col.value)
        if (typeof parsed === 'object' && parsed !== null && 'text' in parsed) out[key] = parsed.text
        else if (typeof parsed === 'string') out[key] = parsed
        else if (typeof parsed === 'number') out[key] = parsed
        else out[key] = col.value
      } catch {
        out[key] = col.value
      }
    }
  }
  return out
}

export function getCol(col: Record<string, string | number | null>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = col[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return null
}
