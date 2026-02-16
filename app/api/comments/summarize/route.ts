import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

/**
 * POST /api/comments/summarize
 *
 * Accepts an array of comment messages (with optional authors) and a layer name,
 * returns a concise AI-generated summary using extended thinking for
 * better reasoning about comment sequences and actionable decisions.
 *
 * Body: { comments: string[], nodeName: string }
 * Returns: { summary: string }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 503 }
    )
  }

  let body: { comments?: string[]; nodeName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { comments, nodeName } = body
  if (!comments || !Array.isArray(comments) || comments.length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty "comments" array' },
      { status: 400 }
    )
  }

  const layerLabel = nodeName || 'this layer'
  const commentBlock = comments
    .slice(0, 40)
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n')

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      thinking: {
        type: 'enabled',
        budget_tokens: 4000,
      },
      messages: [
        {
          role: 'user',
          content: `Summarize the design feedback on Figma layer "${layerLabel}" for the designer who needs to act on it.

Rules:
- Max 1-2 short sentences. Be blunt and specific.
- Focus on WHAT needs to change, not what was discussed. State decisions and open action items.
- Name concrete design elements: copy text, colors, layout, imagery — not meta-commentary about the conversation.
- If a decision was reached, state it as fact. If something is unresolved, flag it.
- Do not use bullet points, markdown, or filler words.

Comments (chronological):
${commentBlock}`,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const text = textBlock?.type === 'text' ? textBlock.text : ''
    return NextResponse.json({ summary: text.trim() })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
