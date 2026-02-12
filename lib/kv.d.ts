import type { PendingSyncJob, PendingSyncJobState } from '@/src/jobs/types';
/**
 * Vercel KV persistence layer for Bifrost.
 * Replaces the in-memory queue with Redis-backed storage.
 */
export declare function enqueueJob(job: PendingSyncJob): Promise<void>;
export declare function getJobById(id: string): Promise<PendingSyncJob | null>;
export declare function getJobByIdempotencyKey(key: string): Promise<PendingSyncJob | null>;
export declare function getAllJobs(limit?: number): Promise<PendingSyncJob[]>;
export declare function getJobsByState(state: PendingSyncJobState, limit?: number): Promise<PendingSyncJob[]>;
export declare function getJobsByFileKey(fileKey: string, limit?: number): Promise<PendingSyncJob[]>;
export declare function getJobsByBatch(batchCanonical: string, limit?: number): Promise<PendingSyncJob[]>;
export declare function updateJobState(id: string, newState: PendingSyncJobState, updates?: Partial<PendingSyncJob>): Promise<void>;
export declare function deleteJob(id: string): Promise<void>;
export interface RoutingMap {
    [canonicalKey: string]: string;
}
export interface FilterSettings {
    enforceFilters: boolean;
    allowedStatuses: string[];
    allowedTeams: string[];
}
export declare function getRoutingMap(): Promise<RoutingMap>;
export declare function setRoutingMap(map: RoutingMap): Promise<void>;
export declare function getFilterSettings(): Promise<FilterSettings>;
export declare function setFilterSettings(settings: FilterSettings): Promise<void>;
export interface WebhookLogEntry {
    timestamp: string;
    mondayItemId: string;
    itemName: string;
    outcome: 'queued' | 'filtered' | 'error';
    reason?: string;
    errorMessage?: string;
}
export declare function logWebhook(entry: WebhookLogEntry): Promise<void>;
export declare function getWebhookLog(limit?: number): Promise<WebhookLogEntry[]>;
export declare function getQueueStats(): Promise<{
    queued: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
}>;
//# sourceMappingURL=kv.d.ts.map