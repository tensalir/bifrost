import { NextResponse } from 'next/server'
import { handleMondayWebhook } from '@/src/api/webhooks/monday'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = await handleMondayWebhook(body)
    
    if (result.challenge != null) {
      return NextResponse.json({ challenge: result.challenge }, { status: 200 })
    }
    
    return NextResponse.json(
      {
        received: result.received,
        inserted: result.inserted,
        outcome: result.outcome,
        message: result.message,
        error: result.error,
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
