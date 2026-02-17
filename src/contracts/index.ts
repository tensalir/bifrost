export * from './integrations.js'

/**
 * Shared type contracts for Heimdall.
 *
 * These DTOs define the data shapes exchanged between:
 *   - Next.js API routes
 *   - Admin dashboard pages
 *   - Comment sheet pages
 *   - Figma plugin
 *
 * Rules:
 *   - Keep contracts additive (add fields, never remove)
 *   - All fields consumed by the Figma plugin must stay stable
 *   - New optional fields are always safe to add
 */

// ---------------------------------------------------------------------------
//  Jobs
// ---------------------------------------------------------------------------

export type JobState = 'queued' | 'running' | 'completed' | 'failed'

export interface JobSummary {
  id: string
  experimentPageName: string
  batchCanonical: string
  state: JobState
  createdAt: string
  updatedAt: string
}

export interface JobDetail extends JobSummary {
  idempotencyKey: string
  mondayItemId: string
  mondayBoardId: string
  figmaFileKey: string | null
  expectedFileName: string
  briefingPayload: unknown
  nodeMapping?: Array<{ nodeName: string; value: string }>
  frameRenames?: Array<{ oldName: string; newName: string }>
  images?: Array<{ url: string; name: string; source: string }>
  figmaPageId?: string | null
  figmaFileUrl?: string | null
  errorCode?: string | null
}

export interface QueueStats {
  queued: number
  running: number
  completed: number
  failed: number
  total: number
}

// ---------------------------------------------------------------------------
//  Comments / Sheets
// ---------------------------------------------------------------------------

export interface CommentAuthor {
  name: string
  avatar?: string
}

export interface SheetComment {
  id: string
  message: string
  author: CommentAuthor
  createdAt: string
  resolvedAt?: string | null
  threadDepth: number
  replyCount: number
  parentId?: string | null
}

export interface SheetLayer {
  nodeId: string
  nodeName: string
  comments: SheetComment[]
  thumbnailUrl?: string | null
  summary?: string | null
}

export interface SheetPage {
  pageId: string
  pageName: string
  layers: SheetLayer[]
}

export interface CommentSheetPayload {
  fileKey: string
  fileName: string
  lastModified: string
  totalComments: number
  pages: SheetPage[]
}

// ---------------------------------------------------------------------------
//  Health / Setup
// ---------------------------------------------------------------------------

export type ServiceHealth = 'ok' | 'error' | 'unconfigured'

export interface HealthStatus {
  monday: ServiceHealth
  figma: ServiceHealth
  kv: ServiceHealth
  supabase?: ServiceHealth
}

// ---------------------------------------------------------------------------
//  Webhook log
// ---------------------------------------------------------------------------

export interface WebhookLogEntry {
  timestamp: string
  mondayItemId: string
  itemName: string
  outcome: 'queued' | 'filtered' | 'error'
  reason?: string
  errorMessage?: string
}
