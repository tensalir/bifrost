/**
 * Resolve monthly Figma file from Monday batch.
 * Uses explicit mapping store (env or future DB) and naming fallback for display/plugin.
 */

import { getEnv } from '../config/env.js'
import { parseBatchToCanonical, expectedFileNameFromCanonicalKey, type BatchParseResult } from '../domain/routing/batchToFile.js'

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
 * Load batch -> file key map from env HEIMDALL_BATCH_FILE_MAP (JSON object).
 */
function loadBatchFileMap(): Record<string, string> {
  const env = getEnv()
  const raw = env.HEIMDALL_BATCH_FILE_MAP
  if (!raw || typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') out[k] = v
      }
      return out
    }
  } catch {
    // ignore
  }
  return {}
}

/**
 * Resolve Figma target from Monday batch value.
 * Returns expected file name and optional file key from mapping.
 */
export function resolveFigmaTarget(batch: string | null | undefined): FigmaTargetResult | null {
  const batchParse = parseBatchToCanonical(batch)
  if (!batchParse) return null

  const map = loadBatchFileMap()
  const fileKey = map[batchParse.canonicalKey] ?? null

  return {
    batchCanonical: batchParse.canonicalKey,
    expectedFileName: batchParse.expectedFileName,
    figmaFileKey: fileKey,
    batchParse,
  }
}

/**
 * Resolve by canonical key only (when batch already normalized).
 */
export function resolveFigmaTargetByCanonicalKey(canonicalKey: string): FigmaTargetResult {
  const map = loadBatchFileMap()
  const [y, m] = canonicalKey.split('-').map(Number)
  const batchParse: BatchParseResult = {
    canonicalKey,
    expectedFileName: expectedFileNameFromCanonicalKey(canonicalKey),
    year: y,
    month: m,
  }
  return {
    batchCanonical: canonicalKey,
    expectedFileName: batchParse.expectedFileName,
    figmaFileKey: map[canonicalKey] ?? null,
    batchParse,
  }
}
