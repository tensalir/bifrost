/**
 * In-memory pending Figma sync job queue.
 * Plugin polls or fetches queued jobs for current file; backend enqueues on status change.
 * Can be replaced with DB/Redis for persistence.
 */

import type { PendingSyncJob, PendingSyncJobState } from './types.js'

export type { PendingSyncJob, PendingSyncJobState }

const store = new Map<string, PendingSyncJob>()

export function enqueuePendingSyncJob(job: Omit<PendingSyncJob, 'id' | 'state' | 'createdAt' | 'updatedAt'>): PendingSyncJob {
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()
  const full: PendingSyncJob = {
    ...job,
    id,
    state: 'queued',
    createdAt: now,
    updatedAt: now,
  }
  store.set(job.idempotencyKey, full)
  return full
}

export function getPendingJobsByFileKey(figmaFileKey: string): PendingSyncJob[] {
  return [...store.values()].filter(
    (j) => j.state === 'queued' && (j.figmaFileKey === figmaFileKey || !j.figmaFileKey)
  )
}

export function getPendingJobsByBatchCanonical(batchCanonical: string): PendingSyncJob[] {
  return [...store.values()].filter((j) => j.state === 'queued' && j.batchCanonical === batchCanonical)
}

export function getJobByIdempotencyKey(idempotencyKey: string): PendingSyncJob | undefined {
  return store.get(idempotencyKey)
}

export function updateJobState(
  idempotencyKey: string,
  update: {
    state: PendingSyncJobState
    figmaPageId?: string | null
    figmaFileUrl?: string | null
    errorCode?: string | null
  }
): PendingSyncJob | undefined {
  const job = store.get(idempotencyKey)
  if (!job) return undefined
  const updated: PendingSyncJob = {
    ...job,
    ...update,
    updatedAt: new Date().toISOString(),
  }
  store.set(idempotencyKey, updated)
  return updated
}

export function markJobRunning(idempotencyKey: string): PendingSyncJob | undefined {
  return updateJobState(idempotencyKey, { state: 'running' })
}

export function markJobCompleted(
  idempotencyKey: string,
  result: { figmaPageId: string; figmaFileUrl?: string }
): PendingSyncJob | undefined {
  return updateJobState(idempotencyKey, {
    state: 'completed',
    figmaPageId: result.figmaPageId,
    figmaFileUrl: result.figmaFileUrl ?? null,
  })
}

export function markJobFailed(idempotencyKey: string, errorCode: string): PendingSyncJob | undefined {
  return updateJobState(idempotencyKey, { state: 'failed', errorCode })
}
