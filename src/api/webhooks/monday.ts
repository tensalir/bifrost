/**
 * Monday webhook handler logic: verify challenge, filter by status, map to briefing, create or queue.
 */

import { getEnv } from '../../config/env.js'
import { mondayGraphql } from '../../integrations/monday/client.js'
import type { MondayItem } from '../../integrations/monday/client.js'
import { mondayItemToBriefing } from '../../domain/briefing/mondayToBriefing.js'
import { createOrQueueFigmaPage, buildIdempotencyKey } from '../../orchestration/createOrQueueFigmaPage.js'

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

/** Fetch single item by board + item id. */
async function getMondayItem(boardId: string, itemId: string): Promise<MondayItem | null> {
  const data = await mondayGraphql<{
    boards?: Array<{
      items_page?: { items?: MondayItem[] }
    }>
  }>(
    `query ($boardId: ID!, $itemId: ID!) {
      boards(ids: [$boardId]) {
        items_page(limit: 1, query_params: { ids: [$itemId] }) {
          items { id name column_values { id title text value type } }
        }
      }
    }`,
    { boardId, itemId }
  )
  const items = data?.boards?.[0]?.items_page?.items
  return items?.[0] ?? null
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

  const result = createOrQueueFigmaPage(briefing, {
    mondayBoardId: boardId,
    idempotencyKey,
    statusTransitionId: timestamp,
  })

  return {
    received: true,
    inserted: result.outcome === 'queued' || result.outcome === 'created',
    outcome: result.outcome,
    message: result.message,
  }
}
