import { NextRequest, NextResponse } from 'next/server'
import { mondayGraphql } from '@/src/integrations/monday/client'
import { workingDocToBriefingDTO } from '@/src/domain/briefingAssistant/schema'
import { WorkingDocStateSchema } from '@/src/domain/briefingAssistant/schema'
import { createOrQueueFigmaPage, buildIdempotencyKey } from '@/src/orchestration/createOrQueueFigmaPage'

export const dynamic = 'force-dynamic'

const BOARD_ID = process.env.MONDAY_BRIEFING_BOARD_ID ?? process.env.MONDAY_BOARD_ID ?? ''
const DOC_COLUMN_ID = process.env.MONDAY_BRIEFING_DOC_COLUMN_ID ?? process.env.MONDAY_FEEDBACK_DOC_COLUMN_ID ?? ''

function buildBriefingDocMarkdown(sections: {
  idea?: string
  why?: string
  audience?: string
  product?: string
  visual?: string
  copyInfo?: string
  test?: string
  variants?: string
}): string {
  const parts: string[] = []
  const entries: [string, string | undefined][] = [
    ['Idea', sections.idea],
    ['Why', sections.why],
    ['Audience', sections.audience],
    ['Product', sections.product],
    ['Visual', sections.visual],
    ['Copy info', sections.copyInfo],
    ['Test', sections.test],
    ['Variants', sections.variants],
  ]
  for (const [title, value] of entries) {
    if (value?.trim()) {
      parts.push(`## ${title}\n\n${value.trim()}\n`)
    }
  }
  return parts.length ? parts.join('\n') : '(No content.)'
}

/**
 * POST /api/briefing-assistant/send-to-monday
 * Body: WorkingDocState (+ optional monday_item_id if attaching to existing item).
 * Creates Monday item if needed, creates briefing doc, queues Figma sync.
 */
export async function POST(req: NextRequest) {
  if (!BOARD_ID) {
    return NextResponse.json(
      { error: 'MONDAY_BRIEFING_BOARD_ID or MONDAY_BOARD_ID not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const parsed = WorkingDocStateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid working doc state', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const state = parsed.data
    const existingItemId = (body as { monday_item_id?: string }).monday_item_id ?? state.mondayItemId

    let itemId: string

    if (existingItemId) {
      itemId = existingItemId
    } else {
      const groupId = process.env.MONDAY_BRIEFING_GROUP_ID
      let targetGroupId = groupId
      if (!targetGroupId) {
        const boardsData = await mondayGraphql<{
          boards?: Array<{ groups?: Array<{ id: string }> }>
        }>(
          `query ($boardId: ID!) {
            boards(ids: [$boardId]) {
              groups { id }
            }
          }`,
          { boardId: BOARD_ID }
        )
        targetGroupId = boardsData?.boards?.[0]?.groups?.[0]?.id ?? null
      }
      if (!targetGroupId) {
        return NextResponse.json(
          { error: 'No group on board. Set MONDAY_BRIEFING_GROUP_ID or add a group to the board.' },
          { status: 502 }
        )
      }
      const createItem = await mondayGraphql<{ create_item?: { id: string } }>(
        `mutation ($boardId: ID!, $groupId: String!, $itemName: String!) {
          create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName) {
            id
          }
        }`,
        { boardId: BOARD_ID, groupId: targetGroupId, itemName: state.experimentName }
      )
      const newId = createItem?.create_item?.id
      if (!newId) {
        return NextResponse.json(
          { error: 'Monday API: failed to create item. Check board and permissions.' },
          { status: 502 }
        )
      }
      itemId = newId
    }

    if (DOC_COLUMN_ID) {
      const docContent = buildBriefingDocMarkdown(state.sections)
      const createDoc = await mondayGraphql<{ create_doc?: { id: string } }>(
        `mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $title: String!, $content: String!) {
          create_doc(
            board_id: $boardId
            item_id: $itemId
            column_id: $columnId
            title: $title
            content: $content
          ) {
            id
          }
        }`,
        {
          boardId: BOARD_ID,
          itemId,
          columnId: DOC_COLUMN_ID,
          title: state.experimentName,
          content: docContent,
        }
      )
      if (!createDoc?.create_doc?.id) {
        return NextResponse.json(
          { error: 'Monday API: failed to create doc. Check doc column ID and docs:write scope.' },
          { status: 502 }
        )
      }
    }

    const briefing = workingDocToBriefingDTO({ ...state, mondayItemId: itemId }, itemId)
    const result = await createOrQueueFigmaPage(briefing, {
      mondayBoardId: BOARD_ID,
      idempotencyKey: buildIdempotencyKey(itemId),
    })

    return NextResponse.json({
      ok: true,
      monday_item_id: itemId,
      outcome: result.outcome,
      message: result.message,
      job_id: result.job?.id,
      figma_file_key: result.figmaFileKey,
      expected_file_name: result.expectedFileName,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Send to Monday failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
