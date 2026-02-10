/**
 * Fetch Monday Doc blocks for the mapping agent.
 * Requires docs:read scope on the Monday API token.
 * If the doc is inaccessible or the column has no doc id, returns null.
 */

import { mondayGraphql } from './client.js'

/** Extract plain text from a block content (may be Delta JSON or string). */
function blockToText(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>
      if (Array.isArray(parsed.deltaFormat)) {
        return (parsed.deltaFormat as Array<{ insert?: string }>)
          .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
          .join('')
      }
      if (Array.isArray(parsed.ops)) {
        return (parsed.ops as Array<{ insert?: string }>)
          .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
          .join('')
      }
    } catch {
      // keep raw string
    }
    return content
  }
  if (typeof content !== 'object') return String(content)
  const obj = content as Record<string, unknown>
  if (Array.isArray(obj.deltaFormat)) {
    return (obj.deltaFormat as Array<{ insert?: string }>)
      .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
      .join('')
  }
  if (Array.isArray(obj.ops)) {
    return (obj.ops as Array<{ insert?: string }>)
      .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
      .join('')
  }
  if (typeof obj.text === 'string') return obj.text
  return ''
}

/**
 * Fetch a Monday Doc by id and return its block content as a single string (for the mapping agent).
 * Returns null if token missing, doc not found, or API error (e.g. docs:read not granted).
 */
export async function getDocContent(docId: string): Promise<string | null> {
  if (!docId.trim()) return null
  const id = docId.trim().replace(/^doc_/i, '')
  if (!id) return null

  try {
    const objectId = Number(id)
    if (!Number.isFinite(objectId)) return null

    const allBlocks: Array<{ id: string; type?: string; content?: unknown }> = []
    let page = 1
    const limit = 100
    while (true) {
      const data = await mondayGraphql<{
        docs?: Array<{
          id: string
          object_id?: string
          name?: string
          blocks?: Array<{
            id: string
            type?: string
            content?: unknown
          }>
        }>
      }>(
        `query ($objectIds: [ID!]!, $limit: Int!, $page: Int!) {
          docs(object_ids: $objectIds) {
            id
            object_id
            name
            blocks(limit: $limit, page: $page) {
              id
              type
              content
            }
          }
        }`,
        { objectIds: [objectId], limit, page }
      )
      const doc = data?.docs?.[0]
      const blocks = doc?.blocks ?? []
      if (!blocks.length) break
      allBlocks.push(...blocks)
      if (blocks.length < limit) break
      page += 1
    }

    if (!allBlocks.length) return null
    const parts: string[] = []
    for (const block of allBlocks) {
      const text = blockToText(block.content)
      if (text) parts.push(text)
    }
    return parts.length ? parts.join('\n\n') : null
  } catch {
    return null
  }
}

/**
 * Get doc id from a Monday item column value (e.g. Brief column).
 * Column value may be: a string doc id, or JSON like { "docId": 123 } or { "link": "..." }.
 */
export function getDocIdFromColumnValue(value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return s
  try {
    const parsed = JSON.parse(s) as Record<string, unknown>
    if (Array.isArray(parsed.files) && parsed.files.length > 0) {
      const first = parsed.files[0] as Record<string, unknown>
      if (first && typeof first.objectId !== 'undefined') return String(first.objectId)
      if (first && typeof first.linkToFile === 'string') {
        const match = /docs\/(\d+)/i.exec(first.linkToFile)
        if (match) return match[1]
      }
    }
    if (parsed && typeof parsed.docId !== 'undefined') return String(parsed.docId)
    if (parsed && typeof parsed.link === 'string') {
      const match = /doc[s]?\/(\d+)/i.exec(parsed.link) || /id=(\d+)/.exec(parsed.link)
      if (match) return match[1]
    }
  } catch {
    // not JSON
  }
  return s
}
