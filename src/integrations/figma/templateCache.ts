/**
 * Fetch and cache Figma template page node tree for the mapping agent.
 * Uses GET /v1/files/:key with ids and depth; extracts id/name/type only.
 */

import { getFile } from './restClient.js'
import type { TemplateNodeInfo } from '../../agents/mappingAgent.js'

const DEFAULT_TEMPLATE_PAGE_NAMES = ['Briefing Template to Duplicate', 'Briefing Template', 'Template']

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  tree: TemplateNodeInfo[]
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

/** Recursively reduce Figma API node to lightweight { id, name, type, children? }. */
function toNodeInfo(node: { id: string; name?: string; type?: string; children?: unknown[] }): TemplateNodeInfo {
  const info: TemplateNodeInfo = {
    id: node.id,
    name: typeof node.name === 'string' ? node.name : '',
    type: typeof node.type === 'string' ? node.type : 'UNKNOWN',
  }
  if (Array.isArray(node.children) && node.children.length > 0) {
    info.children = node.children
      .filter((c): c is { id: string; name?: string; type?: string; children?: unknown[] } => c !== null && typeof c === 'object' && 'id' in c)
      .map(toNodeInfo)
  }
  return info
}

/** Find node by id in tree (depth-first). */
function findNodeById(
  node: { id: string; name?: string; type?: string; children?: unknown[] },
  id: string
): { id: string; name?: string; type?: string; children?: unknown[] } | null {
  if (node.id === id) return node
  if (!Array.isArray(node.children)) return null
  for (const c of node.children) {
    if (c !== null && typeof c === 'object' && 'id' in c) {
      const found = findNodeById(c as { id: string; name?: string; type?: string; children?: unknown[] }, id)
      if (found) return found
    }
  }
  return null
}

/** Extract the requested node's subtree from file response. */
function extractTreeFromDocument(
  doc: { id?: string; name?: string; type?: string; children?: unknown[] },
  templatePageId: string
): TemplateNodeInfo[] {
  if (!doc) return []
  const root = {
    id: (doc as { id?: string }).id ?? 'root',
    name: (doc as { name?: string }).name,
    type: (doc as { type?: string }).type ?? 'DOCUMENT',
    children: (doc as { children?: unknown[] }).children,
  }
  const target = findNodeById(root, templatePageId)
  if (!target) return []
  return [toNodeInfo(target)]
}

/**
 * Resolve template page node id from file: fetch with depth=1 and find first page whose name matches.
 */
async function resolveTemplatePageId(fileKey: string): Promise<string | null> {
  const meta = await getFile(fileKey, { depth: 1 })
  if (!meta?.document || !('children' in meta.document)) return null
  const children = (meta.document as { children?: Array<{ id: string; name: string }> }).children
  if (!Array.isArray(children)) return null
  for (const page of children) {
    const name = page?.name ?? ''
    if (DEFAULT_TEMPLATE_PAGE_NAMES.some((t) => name.includes(t) || name === t)) {
      return page.id
    }
  }
  return null
}

/**
 * Fetch template page node tree from Figma; return lightweight tree (id, name, type, children).
 * Cached per fileKey (and resolved template page id) with TTL.
 */
export async function getTemplateNodeTree(
  fileKey: string,
  options?: { templatePageId?: string | null; skipCache?: boolean }
): Promise<TemplateNodeInfo[]> {
  let templatePageId = options?.templatePageId ?? null
  if (!templatePageId) {
    templatePageId = await resolveTemplatePageId(fileKey)
    if (!templatePageId) return []
  }

  const cacheKey = `${fileKey}:${templatePageId}`
  if (!options?.skipCache) {
    const entry = cache.get(cacheKey)
    if (entry && entry.expiresAt > Date.now()) return entry.tree
  }

  const meta = await getFile(fileKey, { ids: [templatePageId], depth: 10 })
  if (!meta?.document) return []

  const doc = meta.document as { id?: string; name?: string; type?: string; children?: unknown[] }
  const tree = extractTreeFromDocument(doc, templatePageId)

  cache.set(cacheKey, { tree, expiresAt: Date.now() + CACHE_TTL_MS })
  return tree
}

/**
 * Clear cache (e.g. for tests or on-demand refresh).
 */
export function clearTemplateCache(): void {
  cache.clear()
}
