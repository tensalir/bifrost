import { NextResponse } from 'next/server'
import { mondayGraphql } from '@/src/integrations/monday/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feedback/verify-monday?item_id=...
 * Returns Monday item details (name, board, group, status) for user verification before sending.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const itemId = searchParams.get('item_id')
  if (!itemId) {
    return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
  }

  const data = await mondayGraphql<{
    items?: Array<{
      id: string
      name: string
      board?: { id: string; name: string }
      group?: { id: string; title: string }
      column_values?: Array<{
        id: string
        text: string | null
        type: string
        column?: { title: string }
      }>
    }>
  }>(
    `query ($ids: [ID!]!) {
      items(ids: $ids) {
        id
        name
        board { id name }
        group { id title }
        column_values {
          id
          text
          type
          column { title }
        }
      }
    }`,
    { ids: [itemId] }
  )

  const item = data?.items?.[0]
  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const statusCol = item.column_values?.find(
    (c) => (c.column?.title ?? '').toLowerCase().includes('status')
  )

  return NextResponse.json({
    item_id: item.id,
    name: item.name,
    board_id: item.board?.id ?? null,
    board_name: item.board?.name ?? null,
    group_id: item.group?.id ?? null,
    group_title: item.group?.title ?? null,
    status: statusCol?.text ?? null,
  })
}
