/**
 * Single retrieval interface for evidence used in angle generation.
 * All source adapters normalize to EvidenceSnippet.
 */

import type { EvidenceSnippet } from '../angleContext.js'

/** Filter passed to adapters for product/use-case/recency. */
export interface EvidenceFilter {
  productOrUseCase?: string
  contentBucket?: 'bau' | 'native_style' | 'experimental'
  /** Limit results (default adapter-specific). */
  limit?: number
  /** Only snippets from after this ISO date. */
  since?: string
  tags?: string[]
}

/** Adapter that fetches evidence from one source (Meta, insights, social, static). */
export interface EvidenceSourceAdapter {
  readonly sourceId: string
  /** Fetch snippets matching the filter. Normalize to EvidenceSnippet. */
  getEvidence(filter: EvidenceFilter): Promise<EvidenceSnippet[]>
}
