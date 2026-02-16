import { NextResponse } from 'next/server'
import { mondayGraphql } from '@/src/integrations/monday/client'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const BOARD_ID = process.env.MONDAY_BOARD_ID ?? ''

/** Extract Figma or generic link from column values (brief link column). */
function extractBriefLink(columnValues: Array<{ id: string; title?: string; text?: string; value?: string }>): string | null {
  for (const col of columnValues) {
    const title = (col.title ?? '').toLowerCase()
    const text = (col.text ?? '').trim()
    if (title.includes('brief') || title.includes('link') || title.includes('figma') || title.includes('design') || title.includes('url')) {
      if (text && (text.includes('figma.com') || text.startsWith('http'))) return text
      if (col.value) {
        try {
          const parsed = JSON.parse(col.value) as Record<string, unknown>
          const url = parsed?.url ?? parsed?.text
          if (typeof url === 'string' && (url.includes('figma.com') || url.startsWith('http'))) return url
        } catch {
          // ignore
        }
      }
    }
    if (text.includes('figma.com')) return text
  }
  return null
}

/** Map Monday group title to agency name (normalize for display). */
function groupToAgency(groupTitle: string): string {
  const t = groupTitle.trim()
  if (!t) return 'Other'
  // Keep known names; normalize casing
  const known = ['Gain', 'Monks', 'Statiq', 'Goodo', 'Studio']
  const lower = t.toLowerCase()
  const match = known.find((k) => k.toLowerCase() === lower)
  return match ?? t
}

interface MondayItemRow {
  id: string
  name: string
  group?: { id: string; title: string } | null
  column_values: Array<{ id: string; title?: string; text?: string; value?: string; type?: string }>
}

/**
 * POST /api/feedback/sync
 * Fetches items from the Monday board and upserts feedback_experiments.
 * Body: { roundId?: string, roundName?: string } — if roundId omitted, creates/uses a round for the board.
 */
export async function POST(request: Request) {
  const db = getSupabase()
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }
  if (!BOARD_ID) {
    return NextResponse.json({ error: 'MONDAY_BOARD_ID not configured' }, { status: 500 })
  }

  let body: { roundId?: string; roundName?: string } = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    // optional body
  }

  const allItems: MondayItemRow[] = []
  let cursor: string | null = null

  // First page: boards with items_page and column_values
  const firstPage = await mondayGraphql<{
    boards?: Array<{
      columns?: Array<{ id: string; title: string }>
      items_page?: {
        cursor: string | null
        items: MondayItemRow[]
      }
    }>
  }>(
    `query ($boardId: [ID!]!) {
      boards(ids: $boardId) {
        columns { id title }
        items_page(limit: 500) {
          cursor
          items {
            id
            name
            column_values { id title text value type }
          }
        }
      }
    }`,
    { boardId: [BOARD_ID] }
  )

  const board = firstPage?.boards?.[0]
  if (!board?.items_page) {
    return NextResponse.json({ error: 'Board not found or no access', synced: 0 }, { status: 404 })
  }

  const columnTitleMap = new Map<string, string>()
  for (const col of board.columns ?? []) {
    columnTitleMap.set(col.id, col.title)
  }
  function enrich(items: MondayItemRow[]) {
    for (const item of items) {
      for (const cv of item.column_values) {
        cv.title = columnTitleMap.get(cv.id) ?? cv.id
      }
    }
  }

  enrich(board.items_page.items ?? [])
  allItems.push(...(board.items_page.items ?? []))
  cursor = board.items_page.cursor

  // Paginate
  while (cursor) {
    const nextPage = await mondayGraphql<{
      next_items_page?: {
        cursor: string | null
        items: MondayItemRow[]
      }
    }>(
      `query ($cursor: String!) {
        next_items_page(cursor: $cursor, limit: 500) {
          cursor
          items {
            id
            name
            column_values { id title text value type }
          }
        }
      }`,
      { cursor }
    )
    const page = nextPage?.next_items_page
    if (!page?.items?.length) break
    enrich(page.items)
    allItems.push(...page.items)
    cursor = page.cursor
  }

  // Resolve or create round
  let roundId = body.roundId
  if (!roundId) {
    const roundName = body.roundName ?? `Board ${BOARD_ID}`
    const { data: existing } = await db
      .from('feedback_rounds')
      .select('id')
      .eq('monday_board_id', BOARD_ID)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (existing?.id) {
      roundId = existing.id
    } else {
      const { data: inserted, error: insertErr } = await db
        .from('feedback_rounds')
        .insert({ name: roundName, monday_board_id: BOARD_ID })
        .select('id')
        .single()
      if (insertErr || !inserted?.id) {
        return NextResponse.json({ error: 'Failed to create round', synced: 0 }, { status: 500 })
      }
      roundId = inserted.id
    }
  }

  let upserted = 0
  for (const item of allItems) {
    const agency = groupToAgency(item.group?.title ?? '')
    const briefLink = extractBriefLink(item.column_values)
    const { error } = await db
      .from('feedback_experiments')
      .upsert(
        {
          round_id: roundId,
          monday_item_id: item.id,
          experiment_name: item.name,
          agency,
          brief_link: briefLink ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'round_id,monday_item_id' }
      )
    if (!error) upserted++
  }

  return NextResponse.json({ ok: true, synced: upserted, roundId, totalItems: allItems.length })
}
