import { NextRequest, NextResponse } from 'next/server'
import { exportNodeImages, hasFigmaReadAccess } from '@/src/integrations/figma/restClient'

export const dynamic = 'force-dynamic'

/**
 * GET /api/comments/thumbnail?fileKey=...&nodeId=...
 *
 * Returns the thumbnail URL for a specific node. Called on-demand
 * by the LayerPreviewPanel when a layer is selected.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fileKey = searchParams.get('fileKey')
  const nodeId = searchParams.get('nodeId')

  if (!fileKey || !nodeId) {
    return NextResponse.json({ error: 'Missing fileKey or nodeId' }, { status: 400 })
  }
  if (!hasFigmaReadAccess()) {
    return NextResponse.json({ error: 'No FIGMA_ACCESS_TOKEN' }, { status: 503 })
  }

  try {
    const images = await exportNodeImages(fileKey, [nodeId], { format: 'png', scale: 0.5 })
    const url = images[nodeId] ?? null
    return NextResponse.json({ nodeId, thumbnailUrl: url })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
