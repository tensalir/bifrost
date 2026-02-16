import { kv } from '@vercel/kv';
/**
 * Vercel KV persistence layer for Heimdall.
 * Replaces the in-memory queue with Redis-backed storage.
 */
// ============================================================================
// JOB QUEUE CRUD
// ============================================================================
export async function enqueueJob(job) {
    const { id, idempotencyKey, state, batchCanonical, figmaFileKey, createdAt } = job;
    // Store job data
    await kv.set(`heimdall:job:${id}`, JSON.stringify(job));
    // Add to global sorted set (score = timestamp)
    await kv.zadd('heimdall:jobs:all', { score: new Date(createdAt).getTime(), member: id });
    // Add to state index
    await kv.sadd(`heimdall:jobs:state:${state}`, id);
    // Add to batch index
    await kv.sadd(`heimdall:jobs:batch:${batchCanonical}`, id);
    // Add to file key index
    if (figmaFileKey) {
        await kv.sadd(`heimdall:jobs:fileKey:${figmaFileKey}`, id);
    }
    // Store idempotency mapping
    await kv.set(`heimdall:jobs:idempotency:${idempotencyKey}`, id);
}
export async function getJobById(id) {
    const data = await kv.get(`heimdall:job:${id}`);
    return data ? JSON.parse(data) : null;
}
export async function getJobByIdempotencyKey(key) {
    const id = await kv.get(`heimdall:jobs:idempotency:${key}`);
    return id ? getJobById(id) : null;
}
export async function getAllJobs(limit = 100) {
    const ids = await kv.zrange('heimdall:jobs:all', 0, limit - 1, { rev: true });
    const jobs = await Promise.all(ids.map((id) => getJobById(id)));
    return jobs.filter((j) => j !== null);
}
export async function getJobsByState(state, limit = 100) {
    const ids = await kv.smembers(`heimdall:jobs:state:${state}`);
    const jobs = await Promise.all(ids.slice(0, limit).map((id) => getJobById(id)));
    return jobs.filter((j) => j !== null);
}
export async function getJobsByFileKey(fileKey, limit = 100) {
    const ids = await kv.smembers(`heimdall:jobs:fileKey:${fileKey}`);
    const jobs = await Promise.all(ids.slice(0, limit).map((id) => getJobById(id)));
    return jobs.filter((j) => j !== null);
}
export async function getJobsByBatch(batchCanonical, limit = 100) {
    const ids = await kv.smembers(`heimdall:jobs:batch:${batchCanonical}`);
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
    await kv.set(`heimdall:job:${id}`, JSON.stringify(updatedJob));
    // Update state indices
    if (oldState !== newState) {
        await kv.srem(`heimdall:jobs:state:${oldState}`, id);
        await kv.sadd(`heimdall:jobs:state:${newState}`, id);
    }
}
export async function deleteJob(id) {
    const job = await getJobById(id);
    if (!job)
        return;
    // Remove from all indices
    await kv.del(`heimdall:job:${id}`);
    await kv.zrem('heimdall:jobs:all', id);
    await kv.srem(`heimdall:jobs:state:${job.state}`, id);
    await kv.srem(`heimdall:jobs:batch:${job.batchCanonical}`, id);
    if (job.figmaFileKey) {
        await kv.srem(`heimdall:jobs:fileKey:${job.figmaFileKey}`, id);
    }
    await kv.del(`heimdall:jobs:idempotency:${job.idempotencyKey}`);
}
export async function getRoutingMap() {
    const data = await kv.get('heimdall:settings:routing');
    return data ? JSON.parse(data) : {};
}
export async function setRoutingMap(map) {
    await kv.set('heimdall:settings:routing', JSON.stringify(map));
}
export async function getFilterSettings() {
    const data = await kv.get('heimdall:settings:filters');
    return data
        ? JSON.parse(data)
        : { enforceFilters: false, allowedStatuses: [], allowedTeams: [] };
}
export async function setFilterSettings(settings) {
    await kv.set('heimdall:settings:filters', JSON.stringify(settings));
}
export async function logWebhook(entry) {
    await kv.lpush('heimdall:webhooks:log', JSON.stringify(entry));
    // Cap at 200 entries
    await kv.ltrim('heimdall:webhooks:log', 0, 199);
}
export async function getWebhookLog(limit = 20) {
    const entries = await kv.lrange('heimdall:webhooks:log', 0, limit - 1);
    return entries.map((e) => JSON.parse(e));
}
// ============================================================================
// QUEUE STATS
// ============================================================================
export async function getQueueStats() {
    const [queued, running, completed, failed, totalCount] = await Promise.all([
        kv.scard(`heimdall:jobs:state:queued`),
        kv.scard(`heimdall:jobs:state:running`),
        kv.scard(`heimdall:jobs:state:completed`),
        kv.scard(`heimdall:jobs:state:failed`),
        kv.zcard('heimdall:jobs:all'),
    ]);
    return { queued, running, completed, failed, total: totalCount };
}
//# sourceMappingURL=kv.js.map