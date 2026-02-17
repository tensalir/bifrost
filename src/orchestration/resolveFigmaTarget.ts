/**
 * Resolve monthly Figma file from Monday batch.
 * Delegates to shared integration routing service.
 */

import type { BatchParseResult } from '../domain/routing/batchToFile.js'
import {
  resolveBatchTargetSync,
  resolveBatchTargetByCanonicalKey,
} from '../services/integrationRoutingService.js'

export interface FigmaTargetResult {
  /** Canonical month key (YYYY-MM) */
  batchCanonical: string
  /** Expected file name: MONTH YYYY - PerformanceAds */
  expectedFileName: string
  /** Figma file key if found in mapping; otherwise plugin uses current file. */
  figmaFileKey: string | null
  /** Parse result from batch string */
  batchParse: BatchParseResult
}

/**
 * Resolve Figma target from Monday batch value.
 * Returns expected file name and optional file key from mapping.
 */
export function resolveFigmaTarget(batch: string | null | undefined): FigmaTargetResult | null {
  const target = resolveBatchTargetSync(batch)
  if (!target) return null
  return {
    batchCanonical: target.batch.batchKey,
    expectedFileName: target.batch.expectedFileName,
    figmaFileKey: target.fileKey,
    batchParse: target.batchParse,
  }
}

/**
 * Resolve by canonical key only (when batch already normalized).
 */
export function resolveFigmaTargetByCanonicalKey(canonicalKey: string): FigmaTargetResult {
  const target = resolveBatchTargetByCanonicalKey(canonicalKey)
  return {
    batchCanonical: target.batch.batchKey,
    expectedFileName: target.batch.expectedFileName,
    figmaFileKey: target.fileKey,
    batchParse: target.batchParse,
  }
}
