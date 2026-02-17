/**
 * Unified integration telemetry for dashboard readiness.
 * Emit consistent events per tool + provider call so operations can be monitored in one place.
 */

import { logger } from '../../lib/logger.js'
import type { ToolNamespace } from './integrationExecutionGuard.js'

export type IntegrationProvider = 'monday' | 'figma' | 'frontify'

export interface IntegrationCallEvent {
  tool: ToolNamespace
  provider: IntegrationProvider
  operation: string
  durationMs: number
  outcome: 'ok' | 'error' | 'skipped' | 'filtered'
  idempotencyKey?: string
  /** Optional resource id (e.g. monday item id, board id). */
  resourceId?: string
  errorCode?: string
}

/**
 * Record an integration call for dashboard/ops. Logs with category 'integration' and structured context.
 */
export function recordIntegrationCall(event: IntegrationCallEvent): void {
  const context: Record<string, unknown> = {
    tool: event.tool,
    provider: event.provider,
    operation: event.operation,
    durationMs: event.durationMs,
    outcome: event.outcome,
  }
  if (event.idempotencyKey) context.idempotencyKey = event.idempotencyKey
  if (event.resourceId) context.resourceId = event.resourceId
  if (event.errorCode) context.errorCode = event.errorCode

  const message =
    event.outcome === 'ok'
      ? `Integration ${event.tool}/${event.provider} ${event.operation} ok`
      : `Integration ${event.tool}/${event.provider} ${event.operation} ${event.outcome}`

  if (event.outcome === 'error') {
    logger.warn('integration', message, context)
  } else {
    logger.info('integration', message, context)
  }
}

/**
 * Wrap an async integration call and record telemetry on completion.
 */
export async function withIntegrationTelemetry<T>(
  event: Omit<IntegrationCallEvent, 'durationMs' | 'outcome'>,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    recordIntegrationCall({
      ...event,
      durationMs: Date.now() - start,
      outcome: 'ok',
    })
    return result
  } catch (err) {
    recordIntegrationCall({
      ...event,
      durationMs: Date.now() - start,
      outcome: 'error',
      errorCode: err instanceof Error ? (err as { code?: string }).code ?? undefined : undefined,
    })
    throw err
  }
}
