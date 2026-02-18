import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { WorkingDocSectionsSchema } from '@/src/domain/briefingAssistant/schema'
import { getEvidence } from '@/src/domain/briefingAssistant/sources'
import { validateDatasourceIds } from '@/src/domain/briefingAssistant/datasources'

export const dynamic = 'force-dynamic'

const SECTION_KEYS = [
  'idea',
  'why',
  'audience',
  'product',
  'visual',
  'copyInfo',
  'test',
  'variants',
] as const

/**
 * POST /api/briefing-assistant/generate-briefing
 * Body: { assignmentId, briefName, productOrUseCase, format, funnel, agencyRef, assetCount, sourceIds? }
 * When sourceIds are provided, fetches evidence and injects it into the prompt for data-informed sections.
 * Returns: { sections, evidenceRefs? } for creative validation.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 503 }
    )
  }

  let body: {
    assignmentId?: string
    briefName?: string
    productOrUseCase?: string
    format?: string
    funnel?: string
    agencyRef?: string
    assetCount?: number
    sourceIds?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    briefName = 'Untitled',
    productOrUseCase = '',
    format = 'static',
    funnel = 'tof',
    agencyRef = '',
    assetCount = 4,
    sourceIds: rawSourceIds,
  } = body

  const validSourceIds = validateDatasourceIds(rawSourceIds ?? [])
  const evidence = validSourceIds.length > 0
    ? await getEvidence(validSourceIds, { productOrUseCase, limit: 20 })
    : []
  const evidenceBlock =
    evidence.length > 0
      ? `\n\nEvidence from data sources (use to ground your sections where relevant):\n${evidence
          .map((e, i) => `[${i + 1}] (id: ${e.id}) ${e.text}${e.recency ? ` (${e.recency})` : ''}`)
          .join('\n')}\n`
      : ''

  const prompt = `You are a creative strategist writing a creative briefing for Loop Earplugs. Generate content for a briefing document based on the following metadata.
${evidenceBlock}

Assignment metadata:
- Brief name: ${briefName}
- Product / use case: ${productOrUseCase || '(not specified)'}
- Format: ${format}
- Funnel stage: ${funnel} (tof = top of funnel, bof = bottom of funnel, retention)
- Agency: ${agencyRef || '(not specified)'}
- Number of assets: ${assetCount}

Produce a JSON object with exactly these keys, each with 1-3 sentences of concise, actionable content suitable for a creative brief. Use plain text, no markdown. Where the evidence above supports a section, draw on it.
- idea: The core creative idea or concept
- why: Why this idea matters / strategic rationale
- audience: Target audience description
- product: Product context and positioning
- visual: Visual direction and style notes
- copyInfo: Copy tone, key messages, CTAs
- test: What we're testing or learning
- variants: Any variant considerations (A/B, formats, etc.)

Return ONLY valid JSON in this exact shape:
{"idea":"...","why":"...","audience":"...","product":"...","visual":"...","copyInfo":"...","test":"...","variants":"..."}`

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const rawText = textBlock?.type === 'text' ? textBlock.text.trim() : ''
    if (!rawText) {
      return NextResponse.json(
        { error: 'No content returned from AI' },
        { status: 502 }
      )
    }

    // Extract JSON from potential markdown code blocks
    let jsonStr = rawText
    const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim()
    }

    const parsed = JSON.parse(jsonStr) as Record<string, string>
    const sections: Record<string, string> = {}
    for (const key of SECTION_KEYS) {
      const val = parsed[key]
      if (typeof val === 'string' && val.trim()) {
        sections[key] = val.trim()
      }
    }

    const validated = WorkingDocSectionsSchema.safeParse(sections)
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid sections structure', details: validated.error.flatten() },
        { status: 502 }
      )
    }

    const evidenceRefs = evidence.map((e) => ({ id: e.id, source: e.source, recency: e.recency }))
    return NextResponse.json({
      sections: validated.data,
      evidenceRefs: evidenceRefs.length > 0 ? evidenceRefs : undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
