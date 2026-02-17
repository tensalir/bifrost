import { NextRequest, NextResponse } from 'next/server'
import { WorkingDocStateSchema } from '@/src/domain/briefingAssistant/schema'

export const dynamic = 'force-dynamic'

/**
 * POST /api/briefing-assistant/approve
 * Body: WorkingDocState (Zod-validated).
 * Validates working doc and returns approved; no persistence (state stays in client until send-to-monday).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = WorkingDocStateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid working doc state', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    return NextResponse.json({ approved: true })
  } catch {
    return NextResponse.json({ error: 'Approve failed' }, { status: 500 })
  }
}
