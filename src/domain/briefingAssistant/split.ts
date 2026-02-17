/**
 * Split engine input/output and allocation types.
 * Used by the deterministic split engine to produce briefing assignments.
 */

import { z } from 'zod'
import type { BriefingAssignment } from './schema.js'
import { BriefingAssignmentSchema } from './schema.js'

/** Input to the split engine: revenue target or direct asset count + month. */
export interface SplitInput {
  /** Canonical month key, e.g. 2026-01. */
  batchKey: string
  /** Human-readable batch label, e.g. January 2026. */
  batchLabel: string
  /** Total assets for the month (from revenue targets or override). */
  totalAssets: number
  /** Optional: cap number of briefs (e.g. 53 for January). */
  maxBriefs?: number
}

/** Allocation breakdown produced by the split (for verification and UI). */
export interface SplitAllocation {
  byFunnel: { tof: number; bof: number; retention: number }
  byFormat: {
    static: number
    video: number
    staticCarousel: number
    videoCarousel: number
  }
  byBucket: { bau: number; nativeStyleExperimental: number }
  byAgency: Record<string, number>
  /** Total briefs (rows) produced. */
  briefCount: number
  /** Total assets (sum of assignment asset counts). */
  totalAssets: number
}

/** Output of the split engine: assignments + allocation summary. */
export interface SplitOutput {
  batchKey: string
  batchLabel: string
  assignments: BriefingAssignment[]
  allocation: SplitAllocation
}

/** Configurable split rules (funnel/format/bucket percentages). */
export interface SplitRulesConfig {
  funnel: { tof: number; bof: number; retention: number }
  format: {
    static: number
    video: number
    staticCarousel: number
    videoCarousel: number
  }
  /** Min share for BAU (e.g. 0.7 = 70%). */
  bauMinShare: number
  /** Product tier definitions: high/medium/low with brief counts and assets per brief. */
  productTiers: {
    high: { briefs: number; assetsPerBrief: number; products: string[] }
    medium: { briefs: number; assetsPerBrief: number; products: string[] }
    low: { briefs: number; assetsPerBrief: number; products: string[] }
  }
  /** Agency capacity: experiments × variants = assets. */
  agencyCapacity: Record<string, { experiments: number; variantsPerExperiment: number }>
  /** Standard variants per experiment (e.g. 4). */
  variantsPerExperiment: number
}

// —— Zod schemas for split API ——

export const SplitInputSchema = z.object({
  batchKey: z.string().regex(/^\d{4}-\d{2}$/),
  batchLabel: z.string(),
  totalAssets: z.number().int().min(1),
  maxBriefs: z.number().int().min(1).optional(),
})

export const SplitOutputSchema = z.object({
  batchKey: z.string(),
  batchLabel: z.string(),
  assignments: z.array(BriefingAssignmentSchema),
  allocation: z.object({
    byFunnel: z.object({ tof: z.number(), bof: z.number(), retention: z.number() }),
    byFormat: z.object({
      static: z.number(),
      video: z.number(),
      staticCarousel: z.number(),
      videoCarousel: z.number(),
    }),
    byBucket: z.object({ bau: z.number(), nativeStyleExperimental: z.number() }),
    byAgency: z.record(z.string(), z.number()),
    briefCount: z.number(),
    totalAssets: z.number(),
  }),
})
