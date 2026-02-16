import { NextRequest, NextResponse } from 'next/server'
import { exportNodeImages, hasFigmaReadAccess } from '@/src/integrations/figma/restClient'

export const dynamic = 'force-dynamic'

/**
 * GET /api/comments/thumbnails?fileKey=...&nodeIds=1:2,3:4,5:6
 *
 * Batch-fetches thumbnail URLs for multiple nodes in a single Figma API call.
 * Returns { thumbnails: { "1:2": "https://...", "3:4": "https://..." } }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fileKey = searchParams.get('fileKey')
  const nodeIdsParam = searchParams.get('nodeIds')

  if (!fileKey || !nodeIdsParam) {
    return NextResponse.json({ error: 'Missing fileKey or nodeIds' }, { status: 400 })
  }
  if (!hasFigmaReadAccess()) {
    return NextResponse.json({ error: 'No FIGMA_ACCESS_TOKEN' }, { status: 503 })
  }

  const nodeIds = nodeIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
  if (nodeIds.length === 0) {
    return NextResponse.json({ error: 'Empty nodeIds list' }, { status: 400 })
  }

  // Cap at 50 nodes per request to stay within Figma API limits
  const capped = nodeIds.slice(0, 50)

  try {
    const images = await exportNodeImages(fileKey, capped, { format: 'png', scale: 0.5 })
    return NextResponse.json({ thumbnails: images })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
