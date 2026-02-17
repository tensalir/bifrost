import { NextRequest, NextResponse } from 'next/server'
import { getEvidence, SOURCE_IDS } from '@/src/domain/briefingAssistant/sources'
import type { AngleGenerationResult } from '@/src/domain/briefingAssistant/angleContext'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const sourceIdSet = new Set<string>(SOURCE_IDS)

const BodySchema = z.object({
  assignmentId: z.string(),
  productOrUseCase: z.string(),
  ideationStarter: z.string().optional(),
  sourceIds: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).optional(),
})

/**
 * POST /api/briefing-assistant/angles
 * Body: { assignmentId, productOrUseCase, ideationStarter?, sourceIds?, limit? }
 * Fetches evidence from adapters and returns generated angles (stub: placeholder angles; can wire LLM later).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { assignmentId, productOrUseCase, ideationStarter, sourceIds, limit } = parsed.data
    const validSourceIds = sourceIds?.filter((id) => sourceIdSet.has(id)) ?? ['static_fallback']
    const evidence = await getEvidence(
      validSourceIds as (typeof SOURCE_IDS)[number][],
      { productOrUseCase, limit: limit ?? 15 }
    )
    const angles: AngleGenerationResult['angles'] = [
      {
        title: `${productOrUseCase} — angle 1`,
        hook: ideationStarter ?? evidence[0]?.text ?? 'Lead with benefit over feature.',
        humanInsight: evidence[0]?.text ?? 'Use evidence from sources to shape the angle.',
        confidenceLevel: evidence.length > 0 ? 'high' : 'medium',
        dataRefs: evidence.slice(0, 3).map((e) => e.id),
        combination: productOrUseCase,
      },
    ]
    return NextResponse.json({ angles })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Angle generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
