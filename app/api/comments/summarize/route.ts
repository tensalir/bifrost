import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

/**
 * POST /api/comments/summarize
 *
 * Accepts an array of comment messages and a layer name,
 * returns a concise AI-generated summary of the feedback.
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
    .slice(0, 40) // cap at 40 comments to stay within token limits
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n')

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `You are summarizing design feedback comments on a Figma layer called "${layerLabel}". Write a concise 1-2 sentence summary of the key feedback themes and any action items. Be direct and specific. Do not use bullet points.

Comments:
${commentBlock}`,
        },
      ],
    })

    const text =
      response.content[0]?.type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ summary: text.trim() })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
