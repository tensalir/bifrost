/**
 * Figma REST API client for Heimdall.
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

// ── Teams & Projects ──────────────────────────────────────────────

/** Project item from GET /v1/teams/:team_id/projects */
export interface FigmaProject {
  id: string
  name: string
}

/**
 * List all projects in a Figma team.
 * Uses GET /v1/teams/:team_id/projects.
 * Requires the token to have team-level access.
 */
export async function getTeamProjects(
  teamId: string
): Promise<FigmaProject[]> {
  const token = getFigmaToken()
  if (!token) return []
  const url = `${FIGMA_API_BASE}/teams/${teamId}/projects`
  const res = await fetch(url, { headers: { 'X-Figma-Token': token } })
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) return []
    throw new Error(`Figma API error: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as {
    name?: string
    projects?: Array<{ id: number | string; name: string }>
  }
  if (!Array.isArray(data.projects)) return []
  return data.projects.map((p) => ({
    id: String(p.id),
    name: p.name,
  }))
}

/** Project file list item from GET /v1/projects/:id/files */
export interface FigmaProjectFile {
  key: string
  name: string
  last_modified?: string
  thumbnail_url?: string
}

/**
 * List all files in a Figma project.
 * Requires projects:read scope on the token.
 */
export async function getProjectFiles(
  projectId: string
): Promise<FigmaProjectFile[]> {
  const token = getFigmaToken()
  if (!token) return []
  const url = `${FIGMA_API_BASE}/projects/${projectId}/files`
  const res = await fetch(url, { headers: { 'X-Figma-Token': token } })
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) return []
    throw new Error(`Figma API error: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as {
    name?: string
    files?: Array<{ key?: string; file_key?: string; name?: string; last_modified?: string; thumbnail_url?: string }>
  }
  if (!Array.isArray(data.files)) return []
  return data.files.map((f) => ({
    key: f.key ?? f.file_key ?? '',
    name: f.name ?? '',
    last_modified: f.last_modified,
    thumbnail_url: f.thumbnail_url,
  })).filter((f) => f.key)
}

/** Response shape for GET /v1/files/:key/nodes */
export interface FigmaNodesResponse {
  name?: string
  lastModified?: string
  err?: string
  nodes: Record<
    string,
    {
      document?: unknown
      components?: Record<string, unknown>
      componentSets?: Record<string, unknown>
      schemaVersion?: number
      styles?: Record<string, unknown>
    } | null
  >
}

/**
 * Get specific nodes (and their subtrees) from a file.
 * Uses GET /v1/files/:key/nodes?ids=...&depth=...
 */
export async function getFileNodes(
  fileKey: string,
  nodeIds: string[],
  options?: { depth?: number; geometry?: 'paths' }
): Promise<FigmaNodesResponse | null> {
  const token = getFigmaToken()
  if (!token || nodeIds.length === 0) return null
  const url = new URL(`${FIGMA_API_BASE}/files/${fileKey}/nodes`)
  url.searchParams.set('ids', nodeIds.join(','))
  if (options?.depth != null)
    url.searchParams.set('depth', String(options.depth))
  if (options?.geometry) url.searchParams.set('geometry', options.geometry)
  const res = await fetch(url.toString(), { headers: { 'X-Figma-Token': token } })
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) return null
    throw new Error(`Figma API error: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as FigmaNodesResponse
}

/**
 * Get download URLs for all image fills in a file.
 * Returns map from imageRef (hash) to URL. URLs expire after ~14 days.
 */
export async function getImageFills(
  fileKey: string
): Promise<Record<string, string>> {
  const token = getFigmaToken()
  if (!token) return {}
  const url = `${FIGMA_API_BASE}/files/${fileKey}/images`
  const res = await fetch(url, { headers: { 'X-Figma-Token': token } })
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) return {}
    throw new Error(`Figma API error: ${res.status} ${res.statusText}`)
  }
  // Figma API historically returned { images: {...} } but newer responses may be wrapped
  // as { meta: { images: {...} }, status, error }.
  const data = (await res.json()) as {
    images?: Record<string, string>
    meta?: { images?: Record<string, string> }
  }
  return data.images ?? data.meta?.images ?? {}
}

// ── Comments API ──────────────────────────────────────────────────

/** User object returned by the Figma REST API. */
export interface FigmaUser {
  handle: string
  img_url: string
  id?: string
}

/** Comment object from GET /v1/files/:key/comments. */
export interface FigmaComment {
  id: string
  message: string
  created_at: string
  resolved_at: string | null
  user: FigmaUser
  client_meta: {
    node_id?: string
    node_offset?: { x: number; y: number }
    x?: number
    y?: number
  } | null
  file_key: string
  parent_id: string | null
  order_id: number | null
  reactions: Array<{ emoji: string; user: FigmaUser; created_at: string }>
}

/**
 * Get all comments on a file.
 * Uses GET /v1/files/:key/comments
 * Requires file_comments:read scope on the token.
 */
export async function getFileComments(
  fileKey: string,
  options?: { asMarkdown?: boolean }
): Promise<FigmaComment[]> {
  const token = getFigmaToken()
  if (!token) return []
  const url = new URL(`${FIGMA_API_BASE}/files/${fileKey}/comments`)
  if (options?.asMarkdown) url.searchParams.set('as_md', 'true')
  const res = await fetch(url.toString(), { headers: { 'X-Figma-Token': token } })
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) return []
    throw new Error(`Figma API error: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as { comments?: FigmaComment[] }
  return data.comments ?? []
}

/** Consolidated comment with thread info and resolved node path. */
export interface ConsolidatedComment {
  id: string
  orderNumber: number | null
  author: string
  authorAvatar: string
  message: string
  createdAt: string
  resolvedAt: string | null
  status: 'open' | 'resolved'
  nodeId: string | null
  parentId: string | null
  threadDepth: number
  replyCount: number
}

/**
 * Fetch comments for a file and consolidate into a flat list with
 * thread depth, reply counts, and status.
 */
export async function getConsolidatedComments(
  fileKey: string,
  options?: { asMarkdown?: boolean }
): Promise<ConsolidatedComment[]> {
  const raw = await getFileComments(fileKey, options)
  if (raw.length === 0) return []

  const byId = new Map<string, FigmaComment>()
  for (const c of raw) byId.set(c.id, c)

  // Count replies per top-level comment
  const replyCounts = new Map<string, number>()
  for (const c of raw) {
    if (c.parent_id) {
      replyCounts.set(c.parent_id, (replyCounts.get(c.parent_id) ?? 0) + 1)
    }
  }

  // Compute thread depth (0 for top-level, 1 for replies, etc.)
  function depth(c: FigmaComment): number {
    let d = 0
    let current = c
    while (current.parent_id && byId.has(current.parent_id)) {
      d++
      current = byId.get(current.parent_id)!
    }
    return d
  }

  return raw.map((c) => ({
    id: c.id,
    orderNumber: c.order_id,
    author: c.user.handle,
    authorAvatar: c.user.img_url,
    message: c.message,
    createdAt: c.created_at,
    resolvedAt: c.resolved_at,
    status: c.resolved_at ? 'resolved' as const : 'open' as const,
    nodeId: c.client_meta?.node_id ?? null,
    parentId: c.parent_id,
    threadDepth: depth(c),
    replyCount: replyCounts.get(c.id) ?? 0,
  }))
}

// ── Image Export ──────────────────────────────────────────────────

/**
 * Export nodes as images (PNG/SVG/JPG/PDF).
 * Returns map from node id to image URL. URLs expire after ~30 days.
 */
export async function exportNodeImages(
  fileKey: string,
  nodeIds: string[],
  options?: { format?: 'png' | 'jpg' | 'svg' | 'pdf'; scale?: number }
): Promise<Record<string, string>> {
  const token = getFigmaToken()
  if (!token || nodeIds.length === 0) return {}
  const url = new URL(`${FIGMA_API_BASE}/images/${fileKey}`)
  url.searchParams.set('ids', nodeIds.join(','))
  if (options?.format) url.searchParams.set('format', options.format)
  if (options?.scale != null)
    url.searchParams.set('scale', String(options.scale))
  const res = await fetch(url.toString(), { headers: { 'X-Figma-Token': token } })
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) return {}
    throw new Error(`Figma API error: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as { err?: string; images?: Record<string, string> }
  if (data.err) throw new Error(`Figma export error: ${data.err}`)
  return data.images ?? {}
}
