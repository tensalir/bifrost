import { NextRequest, NextResponse } from 'next/server'
import { getJobsByFileKey } from '@/lib/kv'

export const dynamic = 'force-dynamic'

/**
 * GET /api/plugin/sync-status?fileKey=...
 * Returns job counts and list for this file (queued, completed, failed).
 * Plugin can poll until queued === 0 to know queueing is done.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileKey = searchParams.get('fileKey') ?? searchParams.get('file_key') ?? ''

    if (!fileKey) {
      return NextResponse.json({ error: 'fileKey required' }, { status: 400 })
    }

    const allJobs = await getJobsByFileKey(fileKey)
    const queued = allJobs.filter((j) => j.state === 'queued')
    const completed = allJobs.filter((j) => j.state === 'completed')
    const failed = allJobs.filter((j) => j.state === 'failed')

    return NextResponse.json({
      total: allJobs.length,
      queued: queued.length,
      completed: completed.length,
      failed: failed.length,
      items: allJobs.map((j) => ({
        id: j.id,
        idempotencyKey: j.idempotencyKey,
        experimentPageName: j.experimentPageName,
        state: j.state,
        figmaPageId: j.figmaPageId,
        errorCode: j.errorCode,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
