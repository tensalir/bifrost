import { NextRequest, NextResponse } from 'next/server'
import { SplitInputSchema } from '@/src/domain/briefingAssistant/split'
import { runSplit } from '@/src/domain/briefingAssistant/splitEngine'

export const dynamic = 'force-dynamic'

/**
 * POST /api/briefing-assistant/split
 * Body: { batchKey, batchLabel, totalAssets, maxBriefs? }
 * Returns: SplitOutput (assignments + allocation).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = SplitInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const output = runSplit(parsed.data)
    return NextResponse.json(output)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Split failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
