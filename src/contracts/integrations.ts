/**
 * Canonical integration contracts for Monday/Figma/Frontify.
 * Shared across Briefing Assistant, Comment Summarizer, plugin, and future tools.
 * Vendor-neutral so we can swap providers later.
 */

// ---------------------------------------------------------------------------
//  Batch & routing
// ---------------------------------------------------------------------------

/** Canonical batch reference (e.g. YYYY-MM). Used for routing to boards and files. */
export interface BatchRef {
  /** Canonical key, e.g. "2026-03" */
  batchKey: string
  /** Human-readable label, e.g. "March 2026" */
  batchLabel: string
  /** Expected design file name pattern (vendor-agnostic), e.g. "MARCH 2026 - PerformanceAds" */
  expectedFileName: string
}

// ---------------------------------------------------------------------------
//  Work items (board items / experiments)
// ---------------------------------------------------------------------------

/** Reference to a single work item on an external board. */
export interface WorkItemRef {
  /** Provider-specific board id (e.g. Monday board id) */
  boardId: string
  /** Provider-specific item id (e.g. Monday pulse id) */
  itemId: string
  /** Display name */
  name: string
}

// ---------------------------------------------------------------------------
//  Assets & links
// ---------------------------------------------------------------------------

/** Reference to an external asset (file, image). */
export interface AssetRef {
  url: string
  name: string
  /** Optional provider asset id for deduplication */
  assetId?: string
  /** Source column or context */
  source: string
}

/** External link (Figma, brief doc, etc.). */
export interface ExternalLinkRef {
  url: string
  /** Optional label, e.g. "Figma", "Brief" */
  label?: string
}

// ---------------------------------------------------------------------------
//  Resolved target (batch → board + file)
// ---------------------------------------------------------------------------

/** Result of resolving a batch to board and design file. */
export interface ResolvedBatchTarget {
  batch: BatchRef
  /** Provider board id (e.g. Monday), or null if not configured */
  boardId: string | null
  /** Design file key (e.g. Figma file key), or null if not mapped */
  fileKey: string | null
}

// ---------------------------------------------------------------------------
//  Sync outcomes
// ---------------------------------------------------------------------------

export type SyncOutcomeStatus = 'created' | 'queued' | 'skipped' | 'failed' | 'synced' | 'filtered'

/** Result of a sync/launch operation. */
export interface SyncOutcome {
  status: SyncOutcomeStatus
  /** Idempotency key used for this operation */
  idempotencyKey?: string
  message: string
  /** Resolved file key if applicable */
  fileKey?: string | null
  /** Job id if queued */
  jobId?: string
}

// ---------------------------------------------------------------------------
//  Error taxonomy (vendor-neutral, for guards and telemetry)
// ---------------------------------------------------------------------------

export type IntegrationErrorCode =
  | 'provider_unconfigured'
  | 'provider_auth'
  | 'provider_rate_limit'
  | 'provider_not_found'
  | 'validation_failed'
  | 'batch_unparseable'
  | 'file_not_mapped'
  | 'transient'
  | 'unknown'

export interface IntegrationError {
  code: IntegrationErrorCode
  message: string
  /** If true, callers may retry. */
  retryable: boolean
  /** Optional provider-specific detail (e.g. Monday error message). */
  detail?: string
}
