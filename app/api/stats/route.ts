import { NextResponse } from 'next/server'
import { getQueueStats, getBatchStats } from '@/lib/kv'

export async function GET() {
  try {
    const [queueStats, batchStats] = await Promise.all([getQueueStats(), getBatchStats()])
    return NextResponse.json({ stats: queueStats, batchStats }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
