/**
 * Tool-scoped execution guards to prevent cross-tool interference.
 * Idempotency keys are namespaced by tool; errors are normalized for retry logic.
 */

import type { IntegrationError, IntegrationErrorCode } from '../contracts/integrations.js'

export type ToolNamespace = 'feedback' | 'briefing' | 'plugin'

/**
 * Build an idempotency key with tool namespace so different tools never collide.
 * Format: {tool}:{scope}:{payload}
 */
export function buildToolIdempotencyKey(
  tool: ToolNamespace,
  scope: string,
  payload: string
): string {
  return `${tool}:${scope}:${payload}`
}

/**
 * Legacy idempotency key (monday:itemId:ts) as scope+payload for use with buildToolIdempotencyKey.
 * Use from webhook/briefing: buildToolIdempotencyKey('briefing', 'monday', `${itemId}:${ts}`)
 */
export function buildMondayScopePayload(mondayItemId: string, statusTransitionId?: string): string {
  const ts = statusTransitionId ?? String(Date.now())
  return `${mondayItemId}:${ts}`
}

/**
 * Normalize an error to IntegrationError and classify as retryable or not.
 */
export function toIntegrationError(err: unknown): IntegrationError {
  const message = err instanceof Error ? err.message : String(err)
  let code: IntegrationErrorCode = 'unknown'
  let retryable = false

  if (err instanceof Error) {
    const msg = message.toLowerCase()
    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
      code = 'provider_rate_limit'
      retryable = true
    } else if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('network')) {
      code = 'transient'
      retryable = true
    } else if (msg.includes('not found') || msg.includes('404')) {
      code = 'provider_not_found'
    } else if (msg.includes('auth') || msg.includes('401') || msg.includes('403')) {
      code = 'provider_auth'
    } else if (msg.includes('token') && (msg.includes('missing') || msg.includes('not set'))) {
      code = 'provider_unconfigured'
    } else if (msg.includes('parse') || msg.includes('validation')) {
      code = 'validation_failed'
    } else if (msg.includes('batch') && msg.includes('unparseable')) {
      code = 'batch_unparseable'
    } else if (msg.includes('file') && msg.includes('mapping')) {
      code = 'file_not_mapped'
    }
  }

  return { code, message, retryable, detail: err instanceof Error ? err.message : undefined }
}

export function isRetryableError(error: IntegrationError): boolean {
  return error.retryable
}

/**
 * Lock key for a long-running operation. Use with KV or similar for actual locking.
 * Format: heimdall:lock:{tool}:{operationType}:{resourceId}
 */
export function buildLockKey(
  tool: ToolNamespace,
  operationType: string,
  resourceId: string
): string {
  return `heimdall:lock:${tool}:${operationType}:${resourceId}`
}
