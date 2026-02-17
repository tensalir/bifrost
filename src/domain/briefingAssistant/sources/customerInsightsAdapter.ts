/**
 * Customer insights (interviews, surveys) evidence adapter.
 * Normalizes to EvidenceSnippet for angle generation.
 */

import type { EvidenceSourceAdapter } from './types.js'
import type { EvidenceSnippet } from '../angleContext.js'
import type { EvidenceFilter } from './types.js'

const SOURCE_ID = 'customer_insights'

/** Adapter for customer interviews / survey insights. Stub until insights API is wired. */
export const customerInsightsAdapter: EvidenceSourceAdapter = {
  sourceId: SOURCE_ID,

  async getEvidence(filter: EvidenceFilter): Promise<EvidenceSnippet[]> {
    const limit = filter.limit ?? 20
    const staticSamples = getStaticInsightSamples(filter.productOrUseCase)
    return staticSamples.slice(0, limit)
  },
}

function getStaticInsightSamples(productOrUseCase?: string): EvidenceSnippet[] {
  const base: EvidenceSnippet[] = [
    {
      id: 'insight-1',
      text: 'Users mention sleep quality improvement when they use the product at night.',
      source: SOURCE_ID,
      recency: new Date().toISOString().slice(0, 10),
      provenance: 'Customer interview',
      tags: ['dream', 'retention'],
    },
    {
      id: 'insight-2',
      text: 'Noise sensitivity is a key driver for consideration in the 25–44 segment.',
      source: SOURCE_ID,
      recency: new Date().toISOString().slice(0, 10),
      provenance: 'Survey',
      tags: ['quiet', 'bof'],
    },
  ]
  if (productOrUseCase) {
    const q = productOrUseCase.toLowerCase()
    return base.filter((s) => s.tags?.some((t) => t.includes(q))) || base
  }
  return base
}
