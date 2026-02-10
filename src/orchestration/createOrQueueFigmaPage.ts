/**
 * Capability-gated orchestration: attempt server-write path or enqueue for plugin sync.
 * Figma REST API does not support creating/duplicating pages; V1 always queues and uses plugin.
 */

import { getEnv, isDryRun } from '../config/env.js'
import type { BriefingDTO } from '../domain/briefing/schema.js'
import { formatExperimentPageName } from '../domain/briefing/schema.js'
import { resolveFigmaTarget } from './resolveFigmaTarget.js'
import { hasFigmaReadAccess } from '../integrations/figma/restClient.js'
import {
  enqueuePendingSyncJob,
  getJobByIdempotencyKey,
  type PendingSyncJob,
} from '../jobs/pendingFigmaSyncQueue.js'

export type CreateOrQueueOutcome = 'created' | 'queued' | 'skipped' | 'failed'

export interface CreateOrQueueResult {
  outcome: CreateOrQueueOutcome
  idempotencyKey: string
  job?: PendingSyncJob
  /** Human message for logs */
  message: string
  /** Resolved file key if known */
  figmaFileKey: string | null
  expectedFileName: string
}

/**
 * Build idempotency key for Monday status transition.
 */
export function buildIdempotencyKey(mondayItemId: string, statusTransitionId?: string): string {
  if (statusTransitionId) return `monday:${mondayItemId}:${statusTransitionId}`
  return `monday:${mondayItemId}:${Date.now()}`
}

/**
 * Create Figma experiment page (server path) or queue for plugin.
 * V1: server path is disabled (REST cannot create pages); we always queue.
 * When nodeMapping/frameRenames are provided (from mapping agent), the plugin applies them by node name.
 */
export function createOrQueueFigmaPage(
  briefing: BriefingDTO,
  options: {
    mondayBoardId: string
    idempotencyKey?: string
    statusTransitionId?: string
    nodeMapping?: Array<{ nodeName: string; value: string }>
    frameRenames?: Array<{ oldName: string; newName: string }>
  }
): CreateOrQueueResult {
  const idempotencyKey = options.idempotencyKey ?? buildIdempotencyKey(briefing.mondayItemId, options.statusTransitionId)

  const existing = getJobByIdempotencyKey(idempotencyKey)
  if (existing) {
    return {
      outcome: existing.state === 'completed' ? 'skipped' : 'queued',
      idempotencyKey,
      job: existing,
      message: existing.state === 'completed' ? 'Already completed' : 'Already queued',
      figmaFileKey: existing.figmaFileKey,
      expectedFileName: existing.expectedFileName,
    }
  }

  const target = resolveFigmaTarget(briefing.batchRaw ?? briefing.batchCanonical)
  if (!target) {
    return {
      outcome: 'failed',
      idempotencyKey,
      message: 'Could not resolve batch to monthly file',
      figmaFileKey: null,
      expectedFileName: '',
    }
  }

  if (isDryRun()) {
    return {
      outcome: 'queued',
      idempotencyKey,
      message: '[DRY RUN] Would queue plugin sync',
      figmaFileKey: target.figmaFileKey,
      expectedFileName: target.expectedFileName,
    }
  }

  const serverWriteAvailable = false
  if (serverWriteAvailable && hasFigmaReadAccess()) {
    return {
      outcome: 'created',
      idempotencyKey,
      message: 'Server write path not implemented in V1',
      figmaFileKey: target.figmaFileKey,
      expectedFileName: target.expectedFileName,
    }
  }

  const job = enqueuePendingSyncJob({
    idempotencyKey,
    mondayItemId: briefing.mondayItemId,
    mondayBoardId: options.mondayBoardId,
    batchCanonical: target.batchCanonical,
    figmaFileKey: target.figmaFileKey,
    expectedFileName: target.expectedFileName,
    experimentPageName: formatExperimentPageName(briefing),
    briefingPayload: briefing,
    nodeMapping: options.nodeMapping,
    frameRenames: options.frameRenames,
  })

  return {
    outcome: 'queued',
    idempotencyKey,
    job,
    message: 'Queued for plugin sync; open the monthly file and run Sync queued briefings',
    figmaFileKey: target.figmaFileKey,
    expectedFileName: target.expectedFileName,
  }
}
