/**
 * Shared Monday board reader: schema fetch, paginated item fetch, column enrichment.
 * Used by feedback sync, briefing batch dropdown, and future tools.
 */

import { mondayGraphql } from '../integrations/monday/client.js'

export interface MondayBoardColumn {
  id: string
  title: string
}

export interface MondayBoardItemRow {
  id: string
  name: string
  group?: { id: string; title: string } | null
  column_values: Array<{
    id: string
    title?: string
    column?: { title: string }
    text?: string
    value?: string
    type?: string
  }>
}

export interface MondayBoardPage {
  items: MondayBoardItemRow[]
  cursor: string | null
}

export interface ReadBoardResult {
  items: MondayBoardItemRow[]
  boardFound: boolean
}

/**
 * Fetch all items from a Monday board with pagination.
 * Enriches each item's column_values with column title from board schema.
 */
export async function readMondayBoardItems(
  boardId: string,
  options?: { limitPerPage?: number }
): Promise<MondayBoardItemRow[]> {
  const result = await readMondayBoardItemsWithMeta(boardId, options)
  return result.items
}

/**
 * Same as readMondayBoardItems but returns boardFound so callers can distinguish no-access from empty board.
 */
export async function readMondayBoardItemsWithMeta(
  boardId: string,
  options?: { limitPerPage?: number }
): Promise<ReadBoardResult> {
  const limit = options?.limitPerPage ?? 500
  const allItems: MondayBoardItemRow[] = []
  let cursor: string | null = null

  const firstPage = await mondayGraphql<{
    boards?: Array<{
      columns?: Array<{ id: string; title: string }>
      items_page?: { cursor: string | null; items: MondayBoardItemRow[] }
    }>
  }>(
    `query ($boardId: [ID!]!, $limit: Int!) {
      boards(ids: $boardId) {
        columns { id title }
        items_page(limit: $limit) {
          cursor
          items {
            id
            name
            group { id title }
            column_values { id text value type column { title } }
          }
        }
      }
    }`,
    { boardId: [boardId], limit }
  )

  const board = firstPage?.boards?.[0]
  if (!board) {
    return { items: [], boardFound: false }
  }
  if (!board.items_page) {
    return { items: [], boardFound: true }
  }

  const columnTitleMap = new Map<string, string>()
  for (const col of board.columns ?? []) {
    columnTitleMap.set(col.id, col.title)
  }

  function enrich(items: MondayBoardItemRow[]) {
    for (const item of items) {
      for (const cv of item.column_values) {
        cv.title = cv.column?.title ?? columnTitleMap.get(cv.id) ?? cv.id
      }
    }
  }

  enrich(board.items_page.items ?? [])
  allItems.push(...(board.items_page.items ?? []))
  cursor = board.items_page.cursor

  while (cursor) {
    const nextPage = await mondayGraphql<{
      next_items_page?: { cursor: string | null; items: MondayBoardItemRow[] }
    }>(
      `query ($cursor: String!, $limit: Int!) {
        next_items_page(cursor: $cursor, limit: $limit) {
          cursor
          items {
            id
            name
            group { id title }
            column_values { id text value type column { title } }
          }
        }
      }`,
      { cursor, limit }
    )
    const page = nextPage?.next_items_page
    if (!page?.items?.length) break
    enrich(page.items)
    allItems.push(...page.items)
    cursor = page.cursor
  }

  return { items: allItems, boardFound: true }
}

/**
 * Get distinct values for a column by title (e.g. "Batch").
 * Uses board reader and collects unique non-empty text values.
 */
export async function getDistinctColumnValues(
  boardId: string,
  columnTitle: string
): Promise<string[]> {
  const items = await readMondayBoardItems(boardId)
  const columnKey = columnTitle.toLowerCase().trim().replace(/\s+/g, '_')
  const seen = new Set<string>()
  for (const item of items) {
    for (const cv of item.column_values) {
      const title = (cv.title ?? '').toLowerCase().replace(/\s+/g, '_')
      if (title !== columnKey) continue
      const text = (cv.text ?? '').trim()
      if (text) seen.add(text)
    }
  }
  return Array.from(seen)
}
