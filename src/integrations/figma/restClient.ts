/**
 * Figma REST API client for Bifrost.
 * Read-only file/nodes; write operations are done via plugin.
 */

const FIGMA_API_BASE = 'https://api.figma.com/v1'

function getFigmaToken(): string | null {
  return process.env.FIGMA_ACCESS_TOKEN ?? null
}

export interface FigmaFileMeta {
  name: string
  document?: { id: string; name?: string; type?: string; children?: unknown[] }
  version?: string
}

/**
 * Get file metadata and document root. Does not modify file.
 */
export async function getFile(
  fileKey: string,
  options?: { depth?: number; ids?: string[] }
): Promise<FigmaFileMeta | null> {
  const token = getFigmaToken()
  if (!token) return null
  const url = new URL(`${FIGMA_API_BASE}/files/${fileKey}`)
  if (options?.depth != null) url.searchParams.set('depth', String(options.depth))
  if (options?.ids?.length) url.searchParams.set('ids', options.ids.join(','))
  const res = await fetch(url.toString(), { headers: { 'X-Figma-Token': token } })
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) return null
    throw new Error(`Figma API error: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as FigmaFileMeta
  return data
}

/**
 * Check if we have token and optional write capability.
 * REST API does not support creating pages; write path is plugin-only for V1.
 */
export function hasFigmaReadAccess(): boolean {
  return !!getFigmaToken()
}
