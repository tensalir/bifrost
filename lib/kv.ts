import type { PendingSyncJob, PendingSyncJobState } from '../src/jobs/types.js'

/**
 * Vercel KV persistence layer for Bifrost.
 * Replaces the in-memory queue with Redis-backed storage.
 * Falls back to in-memory storage when KV env vars are missing (local dev).
 */

// ---------------------------------------------------------------------------
// In-memory fallback for local dev (no Vercel KV)
// ---------------------------------------------------------------------------
const memStore = new Map<string, string>()
const memSets = new Map<string, Set<string>>()
const memSorted = new Map<string, { score: number; member: string }[]>()
const memLists = new Map<string, string[]>()

function getSet(key: string): Set<string> {
  if (!memSets.has(key)) memSets.set(key, new Set())
  return memSets.get(key)!
}
function getSorted(key: string) {
  if (!memSorted.has(key)) memSorted.set(key, [])
  return memSorted.get(key)!
}
function getList(key: string) {
  if (!memLists.has(key)) memLists.set(key, [])
  return memLists.get(key)!
}

const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

// Lazy-load @vercel/kv only when env vars are present
let _kv: typeof import('@vercel/kv').kv | null = null
async function getKV() {
  if (!hasKV) return null
  if (!_kv) {
    const mod = await import('@vercel/kv')
    _kv = mod.kv
  }
  return _kv
}

// ---------------------------------------------------------------------------
// Thin wrappers that route to KV or in-memory
// ---------------------------------------------------------------------------
async function kvSet(key: string, value: string) {
  const kv = await getKV()
  if (kv) return kv.set(key, value)
  memStore.set(key, value)
}
async function kvGet(key: string): Promise<string | null> {
  const kv = await getKV()
  if (kv) return kv.get<string>(key)
  return memStore.get(key) ?? null
}
async function kvDel(key: string) {
  const kv = await getKV()
  if (kv) return kv.del(key)
  memStore.delete(key)
}
async function kvSadd(key: string, member: string) {
  const kv = await getKV()
  if (kv) return kv.sadd(key, member)
  getSet(key).add(member)
}
async function kvSrem(key: string, member: string) {
  const kv = await getKV()
  if (kv) return kv.srem(key, member)
  getSet(key).delete(member)
}
async function kvSmembers(key: string): Promise<string[]> {
  const kv = await getKV()
  if (kv) return kv.smembers<string[]>(key)
  return [...getSet(key)]
}
async function kvScard(key: string): Promise<number> {
  const kv = await getKV()
  if (kv) return kv.scard(key)
  return getSet(key).size
}
async function kvZadd(key: string, entry: { score: number; member: string }) {
  const kv = await getKV()
  if (kv) return kv.zadd(key, entry)
  const arr = getSorted(key)
  arr.push(entry)
  arr.sort((a, b) => a.score - b.score)
}
async function kvZrange(key: string, start: number, end: number, opts?: { rev?: boolean }): Promise<string[]> {
  const kv = await getKV()
  if (kv) return kv.zrange<string[]>(key, start, end, opts as any)
  let arr = getSorted(key).map((e) => e.member)
  if (opts?.rev) arr = arr.reverse()
  return arr.slice(start, end + 1)
}
async function kvZrem(key: string, member: string) {
  const kv = await getKV()
  if (kv) return kv.zrem(key, member)
  const arr = getSorted(key)
  const idx = arr.findIndex((e) => e.member === member)
  if (idx >= 0) arr.splice(idx, 1)
}
async function kvZcard(key: string): Promise<number> {
  const kv = await getKV()
  if (kv) return kv.zcard(key)
  return getSorted(key).length
}
async function kvLpush(key: string, value: string) {
  const kv = await getKV()
  if (kv) return kv.lpush(key, value)
  getList(key).unshift(value)
}
async function kvLtrim(key: string, start: number, end: number) {
  const kv = await getKV()
  if (kv) return kv.ltrim(key, start, end)
  const list = getList(key)
  memLists.set(key, list.slice(start, end + 1))
}
async function kvLrange(key: string, start: number, end: number): Promise<unknown[]> {
  const kv = await getKV()
  if (kv) return kv.lrange(key, start, end)
  return getList(key).slice(start, end + 1)
}

// ============================================================================
// JOB QUEUE CRUD
// ============================================================================

export async function enqueueJob(job: PendingSyncJob): Promise<void> {
  const { id, idempotencyKey, state, batchCanonical, figmaFileKey, createdAt } = job
  
  // Store job data
  await kvSet(`bifrost:job:${id}`, JSON.stringify(job))
  
  // Add to global sorted set (score = timestamp)
  await kvZadd('bifrost:jobs:all', { score: new Date(createdAt).getTime(), member: id })
  
  // Add to state index
  await kvSadd(`bifrost:jobs:state:${state}`, id)
  
  // Add to batch index
  await kvSadd(`bifrost:jobs:batch:${batchCanonical}`, id)
  
  // Add to file key index
  if (figmaFileKey) {
    await kvSadd(`bifrost:jobs:fileKey:${figmaFileKey}`, id)
  }
  
  // Store idempotency mapping
  await kvSet(`bifrost:jobs:idempotency:${idempotencyKey}`, id)
}

export async function getJobById(id: string): Promise<PendingSyncJob | null> {
  const data = await kvGet(`bifrost:job:${id}`)
  return data ? JSON.parse(data) : null
}

export async function getJobByIdempotencyKey(key: string): Promise<PendingSyncJob | null> {
  const id = await kvGet(`bifrost:jobs:idempotency:${key}`)
  return id ? getJobById(id) : null
}

export async function getAllJobs(limit = 100): Promise<PendingSyncJob[]> {
  const ids = await kvZrange('bifrost:jobs:all', 0, limit - 1, { rev: true })
  const jobs = await Promise.all(ids.map((id: string) => getJobById(id)))
  return jobs.filter((j): j is PendingSyncJob => j !== null)
}

export async function getJobsByState(state: PendingSyncJobState, limit = 100): Promise<PendingSyncJob[]> {
  const ids = await kvSmembers(`bifrost:jobs:state:${state}`)
  const jobs = await Promise.all(ids.slice(0, limit).map((id: string) => getJobById(id)))
  return jobs.filter((j): j is PendingSyncJob => j !== null)
}

export async function getJobsByFileKey(fileKey: string, limit = 100): Promise<PendingSyncJob[]> {
  const ids = await kvSmembers(`bifrost:jobs:fileKey:${fileKey}`)
  const jobs = await Promise.all(ids.slice(0, limit).map((id: string) => getJobById(id)))
  return jobs.filter((j): j is PendingSyncJob => j !== null)
}

export async function getJobsByBatch(batchCanonical: string, limit = 100): Promise<PendingSyncJob[]> {
  const ids = await kvSmembers(`bifrost:jobs:batch:${batchCanonical}`)
  const jobs = await Promise.all(ids.slice(0, limit).map((id: string) => getJobById(id)))
  return jobs.filter((j): j is PendingSyncJob => j !== null)
}

export async function updateJobState(
  id: string,
  newState: PendingSyncJobState,
  updates?: Partial<PendingSyncJob>
): Promise<void> {
  const job = await getJobById(id)
  if (!job) return
  
  const oldState = job.state
  const updatedJob: PendingSyncJob = {
    ...job,
    ...updates,
    state: newState,
    updatedAt: new Date().toISOString(),
  }
  
  // Update job data
  await kvSet(`bifrost:job:${id}`, JSON.stringify(updatedJob))
  
  // Update state indices
  if (oldState !== newState) {
    await kvSrem(`bifrost:jobs:state:${oldState}`, id)
    await kvSadd(`bifrost:jobs:state:${newState}`, id)
  }
}

export async function deleteJob(id: string): Promise<void> {
  const job = await getJobById(id)
  if (!job) return
  
  // Remove from all indices
  await kvDel(`bifrost:job:${id}`)
  await kvZrem('bifrost:jobs:all', id)
  await kvSrem(`bifrost:jobs:state:${job.state}`, id)
  await kvSrem(`bifrost:jobs:batch:${job.batchCanonical}`, id)
  if (job.figmaFileKey) {
    await kvSrem(`bifrost:jobs:fileKey:${job.figmaFileKey}`, id)
  }
  await kvDel(`bifrost:jobs:idempotency:${job.idempotencyKey}`)
}

// ============================================================================
// SETTINGS CRUD
// ============================================================================

export interface RoutingMap {
  [canonicalKey: string]: string // e.g. "2026-03" -> "figmaFileKey..."
}

export interface FilterSettings {
  enforceFilters: boolean
  allowedStatuses: string[]
  allowedTeams: string[]
}

export async function getRoutingMap(): Promise<RoutingMap> {
  const data = await kvGet('bifrost:settings:routing')
  return data ? JSON.parse(data) : {}
}

export async function setRoutingMap(map: RoutingMap): Promise<void> {
  await kvSet('bifrost:settings:routing', JSON.stringify(map))
}

export async function getFilterSettings(): Promise<FilterSettings> {
  const data = await kvGet('bifrost:settings:filters')
  return data
    ? JSON.parse(data)
    : { enforceFilters: false, allowedStatuses: [], allowedTeams: [] }
}

export async function setFilterSettings(settings: FilterSettings): Promise<void> {
  await kvSet('bifrost:settings:filters', JSON.stringify(settings))
}

// ============================================================================
// WEBHOOK LOG
// ============================================================================

export interface WebhookLogEntry {
  timestamp: string
  mondayItemId: string
  itemName: string
  outcome: 'queued' | 'filtered' | 'error'
  reason?: string
  errorMessage?: string
}

export async function logWebhook(entry: WebhookLogEntry): Promise<void> {
  await kvLpush('bifrost:webhooks:log', JSON.stringify(entry))
  // Cap at 200 entries
  await kvLtrim('bifrost:webhooks:log', 0, 199)
}

export async function getWebhookLog(limit = 20): Promise<WebhookLogEntry[]> {
  const entries = await kvLrange('bifrost:webhooks:log', 0, limit - 1)
  if (!entries || !Array.isArray(entries)) return []
  return entries.map((e) => JSON.parse(String(e)))
}

// ============================================================================
// QUEUE STATS
// ============================================================================

export async function getQueueStats() {
  const [queued, running, completed, failed, totalCount] = await Promise.all([
    kvScard(`bifrost:jobs:state:queued`),
    kvScard(`bifrost:jobs:state:running`),
    kvScard(`bifrost:jobs:state:completed`),
    kvScard(`bifrost:jobs:state:failed`),
    kvZcard('bifrost:jobs:all'),
  ])
  
  return { queued, running, completed, failed, total: totalCount }
}
