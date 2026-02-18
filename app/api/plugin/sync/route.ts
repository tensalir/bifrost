import { NextRequest, NextResponse } from 'next/server'
import { queueMondayItem } from '@/src/api/webhooks/monday'
import { upsertSync } from '@/src/services/briefingSyncStore'
export const dynamic = 'force-dynamic'

const BOARD_ID = process.env.MONDAY_BOARD_ID ?? '9147622374'

/**
 * POST /api/plugin/sync
 * Body: { fileKey?: string, items: Array<{ id: string, name: string, batch: string }> }
 * Queues each item via queueMondayItem, then records sync snapshot for each success.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const fileKey = String(body.fileKey ?? '').trim()
    const items = Array.isArray(body.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json({ queued: 0, skipped: 0, jobs: [] })
    }

    const jobs: Array<{ id: string; itemName: string }> = []
    let queued = 0
    let skipped = 0

    for (const it of items) {
      const itemId = String(it.id ?? '').trim()
      const name = String(it.name ?? '').trim()
      const batch = String(it.batch ?? '').trim()
      if (!itemId) continue

      const result = await queueMondayItem(BOARD_ID, itemId, {
        idempotencySuffix: `plugin-${Date.now()}-${itemId}`,
      })

      if (result.outcome === 'queued' || result.outcome === 'skipped') {
        queued++
        if (result.job) jobs.push({ id: result.job.id, itemName: result.job.experimentPageName ?? name })
        if (fileKey) {
          await upsertSync({
            mondayItemId: itemId,
            mondayBoardId: BOARD_ID,
            mondayItemName: name,
            batchCanonical: batch,
            figmaFileKey: fileKey,
            mondaySnapshot: { name, batch, itemId },
          })
        }
      } else {
        skipped++
      }
    }

    return NextResponse.json({
      queued,
      skipped,
      jobs,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
