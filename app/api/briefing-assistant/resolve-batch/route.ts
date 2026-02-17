import { NextRequest, NextResponse } from 'next/server'
import { resolveBatchTarget } from '@/src/services/integrationRoutingService'

export const dynamic = 'force-dynamic'

/**
 * GET /api/briefing-assistant/resolve-batch?batch=2026-03 or ?batch=March%202026
 * Returns batch_key, batch_label, monday_board_id, figma_file_key for the new-sprint form.
 * Uses shared routing service (env map + optional Figma filename match).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const batch = searchParams.get('batch')?.trim()
  if (!batch) {
    return NextResponse.json({ error: 'batch query required' }, { status: 400 })
  }

  const target = await resolveBatchTarget(batch)
  if (!target) {
    return NextResponse.json(
      { error: 'Could not parse batch. Use format like 2026-03 or "March 2026".' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    batch_key: target.batch.batchKey,
    batch_label: target.batch.batchLabel,
    monday_board_id: target.boardId,
    figma_file_key: target.fileKey,
  })
}
