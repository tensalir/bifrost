import { NextResponse } from 'next/server'
import { getWebhookLog } from '@/lib/kv'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10) || 100, 200)
    const entries = await getWebhookLog(limit)
    return NextResponse.json({ entries }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
