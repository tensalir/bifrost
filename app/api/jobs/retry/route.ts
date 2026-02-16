import { NextResponse } from 'next/server'
import { getJobById } from '@/lib/kv'
import { queueMondayItem } from '@/src/api/webhooks/monday'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const jobId = String(body.jobId ?? body.id ?? '')
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 })
    }

    const job = await getJobById(jobId)
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (job.state !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed jobs can be retried' },
        { status: 400 }
      )
    }

    const result = await queueMondayItem(job.mondayBoardId, job.mondayItemId, {
      idempotencySuffix: `retry-${Date.now()}`,
    })

    if (result.error) {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: 500 }
      )
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
