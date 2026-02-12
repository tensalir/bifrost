/**
 * Pending Figma sync job queue - KV-backed persistent storage.
 * Plugin polls or fetches queued jobs for current file; backend enqueues on status change.
 */

import { enqueueJob, getJobByIdempotencyKey as kvGetJobByIdempotencyKey, updateJobState as kvUpdateJobState, getAllJobs, getJobsByFileKey, getJobsByBatch, getJobsByState } from '../../lib/kv.js'
import type { PendingSyncJob, PendingSyncJobState } from './types.js'

export type { PendingSyncJob, PendingSyncJobState }

export async function enqueuePendingSyncJob(
  job: Omit<PendingSyncJob, 'id' | 'state' | 'createdAt' | 'updatedAt'>
): Promise<PendingSyncJob> {
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()
  const full: PendingSyncJob = {
    ...job,
    id,
    state: 'queued',
    createdAt: now,
    updatedAt: now,
  }
  await enqueueJob(full)
  return full
}

export async function getAllPendingJobs(): Promise<PendingSyncJob[]> {
  const jobs = await getJobsByState('queued')
  return jobs
}

export async function getPendingJobsByFileKey(figmaFileKey: string): Promise<PendingSyncJob[]> {
  const jobs = await getJobsByFileKey(figmaFileKey)
  return jobs.filter((j) => j.state === 'queued')
}

export async function getPendingJobsByBatchCanonical(batchCanonical: string): Promise<PendingSyncJob[]> {
  const jobs = await getJobsByBatch(batchCanonical)
  return jobs.filter((j) => j.state === 'queued')
}

export async function getJobByIdempotencyKey(idempotencyKey: string): Promise<PendingSyncJob | undefined> {
  const job = await kvGetJobByIdempotencyKey(idempotencyKey)
  return job ?? undefined
}

async function updateJobStateWrapper(
  idempotencyKey: string,
  update: {
    state: PendingSyncJobState
    figmaPageId?: string | null
    figmaFileUrl?: string | null
    errorCode?: string | null
  }
): Promise<PendingSyncJob | undefined> {
  const job = await kvGetJobByIdempotencyKey(idempotencyKey)
  if (!job) return undefined
  await kvUpdateJobState(job.id, update.state, update)
  const updated = await kvGetJobByIdempotencyKey(idempotencyKey)
  return updated ?? undefined
}

export async function markJobRunning(idempotencyKey: string): Promise<PendingSyncJob | undefined> {
  return updateJobStateWrapper(idempotencyKey, { state: 'running' })
}

export async function markJobCompleted(
  idempotencyKey: string,
  result: { figmaPageId: string; figmaFileUrl?: string }
): Promise<PendingSyncJob | undefined> {
  return updateJobStateWrapper(idempotencyKey, {
    state: 'completed',
    figmaPageId: result.figmaPageId,
    figmaFileUrl: result.figmaFileUrl ?? null,
  })
}

export async function markJobFailed(idempotencyKey: string, errorCode: string): Promise<PendingSyncJob | undefined> {
  return updateJobStateWrapper(idempotencyKey, { state: 'failed', errorCode })
}
