/**
 * Monday webhook handler logic: verify challenge, filter by status, map to briefing, create or queue.
 */

import { getEnv } from '../../config/env.js'
import { mondayGraphql } from '../../integrations/monday/client.js'
import type { MondayItem } from '../../integrations/monday/client.js'
import { mondayItemToBriefing } from '../../domain/briefing/mondayToBriefing.js'
import { createOrQueueFigmaPage, buildIdempotencyKey } from '../../orchestration/createOrQueueFigmaPage.js'
import { resolveFigmaTarget } from '../../orchestration/resolveFigmaTarget.js'
import { getTemplateNodeTree } from '../../integrations/figma/templateCache.js'
import { computeNodeMapping } from '../../agents/mappingAgent.js'
import { getDocContent, getDocIdFromColumnValue } from '../../integrations/monday/docReader.js'
import { columnMap, getCol } from '../../integrations/monday/client.js'

export interface MondayWebhookPayload {
  challenge?: string
  event?: { type?: string }
  pulseId?: string
  boardId?: string
  userId?: string
  timestamp?: string
  /** Status column update may include new value */
  columnId?: string
  value?: unknown
}

/** Fetch single item by board + item id. Uses Monday API v2 column_values schema. */
async function getMondayItem(boardId: string, itemId: string): Promise<MondayItem | null> {
  const data = await mondayGraphql<{
    items?: Array<{
      id: string
      name: string
      column_values: Array<{
        id: string
        text: string | null
        value: string | null
        type: string
        column: { title: string }
      }>
    }>
  }>(
    `query ($ids: [ID!]!) {
      items(ids: $ids) {
        id
        name
        column_values {
          id
          text
          value
          type
          column { title }
        }
      }
    }`,
    { ids: [itemId] }
  )
  const raw = data?.items?.[0]
  if (!raw) return null
  return {
    id: raw.id,
    name: raw.name,
    column_values: raw.column_values.map((cv) => ({
      id: cv.id,
      title: cv.column.title,
      text: cv.text,
      value: cv.value,
      type: cv.type,
    })),
  } as MondayItem
}

/**
 * Verify webhook signature (HMAC) if MONDAY_SIGNING_SECRET is set.
 */
export async function verifyMondayWebhookSignature(payload: string, signature: string | null): Promise<boolean> {
  const secret = getEnv().MONDAY_SIGNING_SECRET
  if (!secret || !signature) return true
  try {
    const crypto = await import('node:crypto')
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

/**
 * Handle Monday webhook body. Returns response shape and outcome.
 */
export async function handleMondayWebhook(body: MondayWebhookPayload): Promise<{
  challenge?: string
  received: boolean
  inserted?: boolean
  outcome?: string
  message?: string
  error?: string
}> {
  if (body.challenge != null) {
    return { challenge: body.challenge, received: true }
  }

  const boardId = String((body as Record<string, string>).boardId ?? (body as Record<string, string>).board_id ?? '')
  const itemId = String((body as Record<string, string>).pulseId ?? (body as Record<string, string>).pulse_id ?? (body as Record<string, string>).item_id ?? '')
  if (!boardId || !itemId) {
    return { received: true }
  }

  const env = getEnv()
  if (env.MONDAY_BOARD_ID && env.MONDAY_BOARD_ID !== boardId) {
    return { received: true }
  }

  const eventType = body.event?.type
  const statusFigmaReady = env.MONDAY_STATUS_FIGMA_READY ?? 'figma_ready'
  const isStatusChange = eventType === 'update' || eventType === 'status_change'
  if (!isStatusChange) {
    return { received: true }
  }

  const item = await getMondayItem(boardId, itemId)
  if (!item) {
    return { received: true, error: 'Item not found' }
  }

  const briefing = mondayItemToBriefing(item)
  if (!briefing) {
    return { received: true, message: 'Batch missing or unparseable' }
  }

  const timestamp = (body as Record<string, string>).timestamp ?? new Date().toISOString()
  const idempotencyKey = buildIdempotencyKey(itemId, timestamp)

  let nodeMapping: Array<{ nodeName: string; value: string }> | undefined
  let frameRenames: Array<{ oldName: string; newName: string }> | undefined
  const target = resolveFigmaTarget(briefing.batchRaw ?? briefing.batchCanonical)
  if (target?.figmaFileKey) {
    try {
      const tree = await getTemplateNodeTree(target.figmaFileKey)
      let mondayDocContent: string | null = null
      const col = columnMap(item)
      const briefRaw = getCol(col, 'brief', 'briefing', 'doc')
      const docId = getDocIdFromColumnValue(briefRaw ?? null)
      if (docId) mondayDocContent = await getDocContent(docId)
      const mapping = await computeNodeMapping(item, tree, {
        mondayDocContent: mondayDocContent ?? undefined,
      })
      nodeMapping = mapping.textMappings
      frameRenames = mapping.frameRenames
    } catch (_) {
      // Fallback: createOrQueueFigmaPage will use briefingPayload-only (plugin fallback)
    }
  }

  const result = createOrQueueFigmaPage(briefing, {
    mondayBoardId: boardId,
    idempotencyKey,
    statusTransitionId: timestamp,
    nodeMapping,
    frameRenames,
  })

  return {
    received: true,
    inserted: result.outcome === 'queued' || result.outcome === 'created',
    outcome: result.outcome,
    message: result.message,
  }
}
