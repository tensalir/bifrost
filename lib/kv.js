import { kv } from '@vercel/kv';
/**
 * Vercel KV persistence layer for Bifrost.
 * Replaces the in-memory queue with Redis-backed storage.
 */
// ============================================================================
// JOB QUEUE CRUD
// ============================================================================
export async function enqueueJob(job) {
    const { id, idempotencyKey, state, batchCanonical, figmaFileKey, createdAt } = job;
    // Store job data
    await kv.set(`bifrost:job:${id}`, JSON.stringify(job));
    // Add to global sorted set (score = timestamp)
    await kv.zadd('bifrost:jobs:all', { score: new Date(createdAt).getTime(), member: id });
    // Add to state index
    await kv.sadd(`bifrost:jobs:state:${state}`, id);
    // Add to batch index
    await kv.sadd(`bifrost:jobs:batch:${batchCanonical}`, id);
    // Add to file key index
    if (figmaFileKey) {
        await kv.sadd(`bifrost:jobs:fileKey:${figmaFileKey}`, id);
    }
    // Store idempotency mapping
    await kv.set(`bifrost:jobs:idempotency:${idempotencyKey}`, id);
}
export async function getJobById(id) {
    const data = await kv.get(`bifrost:job:${id}`);
    return data ? JSON.parse(data) : null;
}
export async function getJobByIdempotencyKey(key) {
    const id = await kv.get(`bifrost:jobs:idempotency:${key}`);
    return id ? getJobById(id) : null;
}
export async function getAllJobs(limit = 100) {
    const ids = await kv.zrange('bifrost:jobs:all', 0, limit - 1, { rev: true });
    const jobs = await Promise.all(ids.map((id) => getJobById(id)));
    return jobs.filter((j) => j !== null);
}
export async function getJobsByState(state, limit = 100) {
    const ids = await kv.smembers(`bifrost:jobs:state:${state}`);
    const jobs = await Promise.all(ids.slice(0, limit).map((id) => getJobById(id)));
    return jobs.filter((j) => j !== null);
}
export async function getJobsByFileKey(fileKey, limit = 100) {
    const ids = await kv.smembers(`bifrost:jobs:fileKey:${fileKey}`);
    const jobs = await Promise.all(ids.slice(0, limit).map((id) => getJobById(id)));
    return jobs.filter((j) => j !== null);
}
export async function getJobsByBatch(batchCanonical, limit = 100) {
    const ids = await kv.smembers(`bifrost:jobs:batch:${batchCanonical}`);
    const jobs = await Promise.all(ids.slice(0, limit).map((id) => getJobById(id)));
    return jobs.filter((j) => j !== null);
}
export async function updateJobState(id, newState, updates) {
    const job = await getJobById(id);
    if (!job)
        return;
    const oldState = job.state;
    const updatedJob = {
        ...job,
        ...updates,
        state: newState,
        updatedAt: new Date().toISOString(),
    };
    // Update job data
    await kv.set(`bifrost:job:${id}`, JSON.stringify(updatedJob));
    // Update state indices
    if (oldState !== newState) {
        await kv.srem(`bifrost:jobs:state:${oldState}`, id);
        await kv.sadd(`bifrost:jobs:state:${newState}`, id);
    }
}
export async function deleteJob(id) {
    const job = await getJobById(id);
    if (!job)
        return;
    // Remove from all indices
    await kv.del(`bifrost:job:${id}`);
    await kv.zrem('bifrost:jobs:all', id);
    await kv.srem(`bifrost:jobs:state:${job.state}`, id);
    await kv.srem(`bifrost:jobs:batch:${job.batchCanonical}`, id);
    if (job.figmaFileKey) {
        await kv.srem(`bifrost:jobs:fileKey:${job.figmaFileKey}`, id);
    }
    await kv.del(`bifrost:jobs:idempotency:${job.idempotencyKey}`);
}
export async function getRoutingMap() {
    const data = await kv.get('bifrost:settings:routing');
    return data ? JSON.parse(data) : {};
}
export async function setRoutingMap(map) {
    await kv.set('bifrost:settings:routing', JSON.stringify(map));
}
export async function getFilterSettings() {
    const data = await kv.get('bifrost:settings:filters');
    return data
        ? JSON.parse(data)
        : { enforceFilters: false, allowedStatuses: [], allowedTeams: [] };
}
export async function setFilterSettings(settings) {
    await kv.set('bifrost:settings:filters', JSON.stringify(settings));
}
export async function logWebhook(entry) {
    await kv.lpush('bifrost:webhooks:log', JSON.stringify(entry));
    // Cap at 200 entries
    await kv.ltrim('bifrost:webhooks:log', 0, 199);
}
export async function getWebhookLog(limit = 20) {
    const entries = await kv.lrange('bifrost:webhooks:log', 0, limit - 1);
    return entries.map((e) => JSON.parse(e));
}
// ============================================================================
// QUEUE STATS
// ============================================================================
export async function getQueueStats() {
    const [queued, running, completed, failed, totalCount] = await Promise.all([
        kv.scard(`bifrost:jobs:state:queued`),
        kv.scard(`bifrost:jobs:state:running`),
        kv.scard(`bifrost:jobs:state:completed`),
        kv.scard(`bifrost:jobs:state:failed`),
        kv.zcard('bifrost:jobs:all'),
    ]);
    return { queued, running, completed, failed, total: totalCount };
}
//# sourceMappingURL=kv.js.map