import { NextResponse } from 'next/server'
import { getFileNodes, getImageFills } from '@/src/integrations/figma/restClient'

/** Max depth for page subtree (full content) */
const NODE_DEPTH = 100

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function collectUsedImageRefs(node: unknown, out: Set<string>): void {
  if (!node || typeof node !== 'object') return
  const anyNode = node as { fills?: unknown; children?: unknown }
  if (Array.isArray((anyNode as { fills?: unknown[] }).fills)) {
    for (const f of (anyNode as { fills: Array<Record<string, unknown>> }).fills) {
      const ref = f?.imageRef
      if (typeof ref === 'string' && ref.trim()) out.add(ref)
    }
  }
  const children = (anyNode as { children?: unknown[] }).children
  if (Array.isArray(children)) {
    for (const c of children) collectUsedImageRefs(c, out)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      fileKey?: string
      pageId?: string
    }
    const fileKey = body.fileKey?.toString().trim()
    const pageId = body.pageId?.toString().trim()
    if (!fileKey || !pageId) {
      return NextResponse.json(
        { error: 'fileKey and pageId are required' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const [nodesRes, imageFills] = await Promise.all([
      getFileNodes(fileKey, [pageId], { depth: NODE_DEPTH }),
      getImageFills(fileKey),
    ])

    if (!nodesRes?.nodes) {
      return NextResponse.json(
        { error: 'Failed to fetch nodes or file not found' },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    const nodeEntry = nodesRes.nodes[pageId]
    if (!nodeEntry?.document) {
      return NextResponse.json(
        { error: 'Page node not found or invalid' },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    // Filter image fill URLs down to only those referenced by this node tree.
    const usedRefs = new Set<string>()
    collectUsedImageRefs(nodeEntry.document, usedRefs)
    const filteredImageFills: Record<string, string> = {}
    const allImageFills = imageFills ?? {}
    for (const ref of usedRefs) {
      const url = allImageFills[ref]
      if (typeof url === 'string' && url) filteredImageFills[ref] = url
    }

    return NextResponse.json(
      {
        nodeTree: nodeEntry.document,
        imageFills: filteredImageFills,
        imageFillCount: Object.keys(filteredImageFills).length,
        components: nodeEntry.components ?? {},
        componentSets: nodeEntry.componentSets ?? {},
        styles: nodeEntry.styles ?? {},
      },
      { status: 200, headers: CORS_HEADERS }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export const dynamic = 'force-dynamic'
