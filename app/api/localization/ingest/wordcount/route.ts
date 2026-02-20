import { NextRequest, NextResponse } from 'next/server'
import { sendWordCountRunToBabylon } from '@/src/integrations/localization/babylonIngest'

export const dynamic = 'force-dynamic'

/**
 * POST /api/localization/ingest/wordcount
 * Accepts a Heimdall plugin wordcount run payload and forwards it to Babylon.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const ack = await sendWordCountRunToBabylon(payload)
    return NextResponse.json(ack, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
