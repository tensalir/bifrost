/**
 * Angle generation context: inputs and evidence shape for the angle generator.
 * Source adapters normalize to EvidenceSnippet for a single retrieval interface.
 */

import { z } from 'zod'

/** Normalized snippet from any source (Meta, customer insights, social comments). */
export interface EvidenceSnippet {
  id: string
  text: string
  /** Source identifier (e.g. meta_ad_comment, customer_interview, social). */
  source: string
  /** When the evidence was captured (ISO date or timestamp). */
  recency: string
  /** Optional provenance for explainability in generated angles. */
  provenance?: string
  /** Optional product/use-case tags for filtering. */
  tags?: string[]
}

/** Input to the angle generator: filters + assignment context. */
export interface AngleGenerationInput {
  /** Product or use case (e.g. quiet, dream, bundles). */
  productOrUseCase: string
  /** Content bucket filter. */
  contentBucket?: 'bau' | 'native_style' | 'experimental'
  /** Optional format constraint. */
  format?: string
  /** Optional funnel constraint. */
  funnel?: string
  /** Evidence snippets from dynamic adapters (or static fallback). */
  evidence: EvidenceSnippet[]
  /** Creative framework hints (SUC, PPR, WWO, etc.). */
  frameworkHints?: string[]
  /** Ideation starter from the assignment. */
  ideationStarter?: string
  /** Max snippets to use in generation (default 10). */
  maxSnippets?: number
}

/** Result of angle generation (one or more angles). */
export interface AngleGenerationResult {
  angles: Array<{
    title: string
    hook: string
    humanInsight: string
    confidenceLevel: 'high' | 'medium' | 'low'
    dataRefs: string[]
    combination?: string
  }>
}

// —— Zod schemas for angle API ——

export const EvidenceSnippetSchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.string(),
  recency: z.string(),
  provenance: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const AngleGenerationInputSchema = z.object({
  productOrUseCase: z.string(),
  contentBucket: z.enum(['bau', 'native_style', 'experimental']).optional(),
  format: z.string().optional(),
  funnel: z.string().optional(),
  evidence: z.array(EvidenceSnippetSchema),
  frameworkHints: z.array(z.string()).optional(),
  ideationStarter: z.string().optional(),
  maxSnippets: z.number().int().min(1).max(50).optional(),
})
