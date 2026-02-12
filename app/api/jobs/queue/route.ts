import { NextResponse } from 'next/server'
import { queueMondayItem } from '@/src/api/webhooks/monday'
import { getEnv } from '@/src/config/env'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const itemId = String(body.mondayItemId ?? body.item_id ?? '')
    const boardId = String(body.mondayBoardId ?? body.board_id ?? getEnv().MONDAY_BOARD_ID ?? '')
    
    if (!itemId || !boardId) {
      return NextResponse.json(
        { error: 'mondayItemId and mondayBoardId (or MONDAY_BOARD_ID) required' },
        { status: 400 }
      )
    }
    
    const result = await queueMondayItem(boardId, itemId)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
