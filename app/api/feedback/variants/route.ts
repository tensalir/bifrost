import { NextRequest, NextResponse } from 'next/server'
import { exportNodeImages, hasFigmaReadAccess } from '@/src/integrations/figma/restClient'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feedback/variants?fileKey=...&nodeIds=... (comma-separated, optional)
 * Attempts to fetch thumbnail URLs from Figma. If nodeIds omitted, uses a single nodeId param for one thumbnail.
 * Returns { accessible: true, thumbnails: { [nodeId]: url } } or { accessible: false, error?: string }.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fileKey = searchParams.get('fileKey')
  const nodeIdsParam = searchParams.get('nodeIds') ?? searchParams.get('nodeId')

  if (!fileKey) {
    return NextResponse.json({ error: 'fileKey is required', accessible: false }, { status: 400 })
  }
  if (!hasFigmaReadAccess()) {
    return NextResponse.json({ accessible: false, error: 'Figma not configured' }, { status: 503 })
  }

  const nodeIds = nodeIdsParam
    ? nodeIdsParam.split(',').map((id) => id.trim()).filter(Boolean).slice(0, 4)
    : []
  const ids = nodeIds.length ? nodeIds : (searchParams.get('nodeId') ? [searchParams.get('nodeId')!] : [])

  if (ids.length === 0) {
    return NextResponse.json({ error: 'nodeId or nodeIds required', accessible: false }, { status: 400 })
  }

  try {
    const thumbnails = await exportNodeImages(fileKey, ids, { format: 'png', scale: 0.5 })
    return NextResponse.json({ accessible: true, thumbnails })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    const is403404 = message.includes('403') || message.includes('404')
    return NextResponse.json(
      { accessible: false, error: message },
      { status: is403404 ? 200 : 502 }
    )
  }
}
