import { NextResponse } from 'next/server'
import { getAllJobs, getJobsByState } from '@/lib/kv'
import type { PendingSyncJobState } from '@/src/jobs/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state') as PendingSyncJobState | null
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200)

    const jobs = state
      ? await getJobsByState(state, limit)
      : await getAllJobs(limit)

    return NextResponse.json({ jobs }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
