import { NextRequest, NextResponse } from 'next/server'
import {
  getFile,
  getFileComments,
  hasFigmaReadAccess,
  type FigmaComment,
} from '@/src/integrations/figma/restClient'

export const dynamic = 'force-dynamic'

// ── Types ────────────────────────────────────────────────────────

interface FigmaTreeNode {
  id: string
  name: string
  type: string
  children?: FigmaTreeNode[]
}

export interface EnrichedComment {
  id: string
  orderNumber: number | null
  author: string
  authorAvatar: string
  message: string
  createdAt: string
  resolvedAt: string | null
  status: 'open' | 'resolved'
  threadDepth: number
  replyCount: number
  parentId: string | null
}

export interface CommentLayer {
  nodeId: string | null
  nodeName: string
  thumbnailUrl: string | null
  comments: EnrichedComment[]
}

export interface CommentPageTab {
  pageId: string
  pageName: string
  layers: CommentLayer[]
  commentCount: number
  openCount: number
  resolvedCount: number
}

export interface CommentSheetData {
  fileName: string
  fileKey: string
  pages: CommentPageTab[]
}

// ── Helpers ──────────────────────────────────────────────────────

function enrichComment(
  c: FigmaComment,
  byId: Map<string, FigmaComment>,
  replyCounts: Map<string, number>
): EnrichedComment {
  let d = 0
  let current = c
  while (current.parent_id && byId.has(current.parent_id)) {
    d++
    current = byId.get(current.parent_id)!
  }
  return {
    id: c.id,
    orderNumber: c.order_id,
    author: c.user.handle,
    authorAvatar: c.user.img_url,
    message: c.message,
    createdAt: c.created_at,
    resolvedAt: c.resolved_at,
    status: c.resolved_at ? 'resolved' : 'open',
    threadDepth: d,
    replyCount: replyCounts.get(c.id) ?? 0,
    parentId: c.parent_id,
  }
}

/** Resolve the effective node_id for a comment (replies inherit from root parent). */
function resolveCommentNodeId(
  c: FigmaComment,
  byId: Map<string, FigmaComment>
): string | null {
  if (c.parent_id && byId.has(c.parent_id)) {
    let root = byId.get(c.parent_id)!
    while (root.parent_id && byId.has(root.parent_id)) {
      root = byId.get(root.parent_id)!
    }
    return root.client_meta?.node_id ?? c.client_meta?.node_id ?? null
  }
  return c.client_meta?.node_id ?? null
}

/** Sort comments into thread order: top-level newest first, replies grouped after parent. */
function sortCommentThreads(comments: EnrichedComment[]): EnrichedComment[] {
  const topLevel = comments
    .filter((c) => c.threadDepth === 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const replies = comments.filter((c) => c.threadDepth > 0)
  const byParent = new Map<string, EnrichedComment[]>()
  for (const r of replies) {
    if (!r.parentId) continue
    if (!byParent.has(r.parentId)) byParent.set(r.parentId, [])
    byParent.get(r.parentId)!.push(r)
  }
  for (const [, group] of byParent) {
    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }
  const result: EnrichedComment[] = []
  for (const tl of topLevel) {
    result.push(tl)
    result.push(...(byParent.get(tl.id) ?? []))
  }
  return result
}

/**
 * Walk the full document tree and build a map of every nodeId to its parent
 * page (CANVAS) id. This lets us attribute comments on deeply nested layers
 * back to the correct page tab.
 */
function buildNodeToPageMap(doc: FigmaTreeNode): Map<string, string> {
  const map = new Map<string, string>()
  for (const page of doc.children ?? []) {
    if (page.type !== 'CANVAS') continue
    map.set(page.id, page.id)
    const walk = (node: FigmaTreeNode) => {
      map.set(node.id, page.id)
      for (const child of node.children ?? []) {
        walk(child)
      }
    }
    walk(page)
  }
  return map
}

// ── Route Handler ────────────────────────────────────────────────

/**
 * GET /api/comments/sheet?fileKey=...
 *
 * Returns CommentSheetData: comments grouped by node ID.
 * Uses only 2 Figma API calls (comments + file tree at depth 1) for speed.
 * Thumbnails are loaded on-demand via /api/comments/thumbnail.
 */
export async function GET(req: NextRequest) {
  const fileKey = new URL(req.url).searchParams.get('fileKey')
  if (!fileKey) {
    return NextResponse.json({ error: 'Missing required query param: fileKey' }, { status: 400 })
  }
  if (!hasFigmaReadAccess()) {
    return NextResponse.json({ error: 'No FIGMA_ACCESS_TOKEN configured' }, { status: 503 })
  }

  try {
    // 2 Figma API calls: comments + full file tree (needed to resolve node → page)
    const [rawComments, fileMeta] = await Promise.all([
      getFileComments(fileKey, { asMarkdown: true }),
      getFile(fileKey),
    ])

    if (!fileMeta || !fileMeta.document) {
      return NextResponse.json({ error: 'Could not fetch file metadata' }, { status: 502 })
    }

    const fileName = fileMeta.name
    const doc = fileMeta.document as unknown as FigmaTreeNode

    // Build page map from document tree
    const pageMap = new Map<string, string>()
    const pageOrder: string[] = []
    for (const page of (doc.children ?? []) as FigmaTreeNode[]) {
      if (page.type !== 'CANVAS') continue
      pageMap.set(page.id, page.name)
      pageOrder.push(page.id)
    }

    // Build nodeId → pageId lookup from full tree so we can attribute
    // comments on any nested layer back to its parent page.
    const nodeToPage = buildNodeToPageMap(doc)

    // Build comment lookup maps
    const byId = new Map<string, FigmaComment>()
    for (const c of rawComments) byId.set(c.id, c)

    const replyCounts = new Map<string, number>()
    for (const c of rawComments) {
      if (c.parent_id) {
        replyCounts.set(c.parent_id, (replyCounts.get(c.parent_id) ?? 0) + 1)
      }
    }

    // Group comments by node ID (layer).
    // Comments on a page itself (nodeId = pageId) are grouped as "Page Canvas".
    // Comments with unknown nodeIds get a label like "Comment #N".
    type LayerBucket = { nodeName: string; comments: EnrichedComment[] }
    const layerBuckets = new Map<string, LayerBucket>()

    for (const c of rawComments) {
      const enriched = enrichComment(c, byId, replyCounts)
      const nodeId = resolveCommentNodeId(c, byId)
      const layerKey = nodeId ?? '__canvas__'

      if (!layerBuckets.has(layerKey)) {
        let nodeName = 'Canvas'
        if (nodeId && pageMap.has(nodeId)) {
          nodeName = `${pageMap.get(nodeId)} (page)`
        } else if (nodeId) {
          nodeName = `Layer ${nodeId}`
        }
        layerBuckets.set(layerKey, { nodeName, comments: [] })
      }
      layerBuckets.get(layerKey)!.comments.push(enriched)
    }

    // Now build page tabs.
    // Strategy: put comments on a page if their nodeId IS a page,
    // or if many comments share the same nodeId range as a page.
    // For the MVP, all comments with resolvable page nodeIds go to that page,
    // and all others go to a single "All Comments" tab.
    const commentsByPage = new Map<string, CommentLayer[]>()

    // Initialize all pages
    for (const pageId of pageOrder) {
      commentsByPage.set(pageId, [])
    }
    commentsByPage.set('__other__', [])

    for (const [layerKey, bucket] of layerBuckets) {
      const sorted = sortCommentThreads(bucket.comments)
      const layer: CommentLayer = {
        nodeId: layerKey === '__canvas__' ? null : layerKey,
        nodeName: bucket.nodeName,
        thumbnailUrl: null, // loaded on-demand by the UI
        comments: sorted,
      }

      // Resolve which page this layer belongs to via the full tree lookup
      const resolvedPageId = layerKey !== '__canvas__' ? nodeToPage.get(layerKey) : undefined

      if (resolvedPageId && commentsByPage.has(resolvedPageId)) {
        commentsByPage.get(resolvedPageId)!.push(layer)
      } else {
        commentsByPage.get('__other__')!.push(layer)
      }
    }

    // Build final page tabs
    const pages: CommentPageTab[] = []

    for (const pageId of pageOrder) {
      const layers = commentsByPage.get(pageId) ?? []
      if (layers.length === 0) continue

      const commentCount = layers.reduce((s, l) => s + l.comments.length, 0)
      layers.sort((a, b) => b.comments.length - a.comments.length)

      pages.push({
        pageId,
        pageName: pageMap.get(pageId) ?? pageId,
        layers,
        commentCount,
        openCount: layers.reduce((s, l) => s + l.comments.filter((c) => c.status === 'open').length, 0),
        resolvedCount: layers.reduce((s, l) => s + l.comments.filter((c) => c.status === 'resolved').length, 0),
      })
    }

    // "Other Comments" — all comments we couldn't map to a specific page
    const otherLayers = commentsByPage.get('__other__') ?? []
    if (otherLayers.length > 0) {
      otherLayers.sort((a, b) => b.comments.length - a.comments.length)
      const commentCount = otherLayers.reduce((s, l) => s + l.comments.length, 0)
      pages.push({
        pageId: '__other__',
        pageName: 'All Comments',
        layers: otherLayers,
        commentCount,
        openCount: otherLayers.reduce((s, l) => s + l.comments.filter((c) => c.status === 'open').length, 0),
        resolvedCount: otherLayers.reduce((s, l) => s + l.comments.filter((c) => c.status === 'resolved').length, 0),
      })
    }

    // Sort: pages with most comments first, "Other" at the end
    pages.sort((a, b) => {
      if (a.pageId === '__other__') return 1
      if (b.pageId === '__other__') return -1
      return b.commentCount - a.commentCount
    })

    const result: CommentSheetData = { fileName, fileKey, pages }
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
