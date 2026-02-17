/**
 * Social comments evidence adapter.
 * Normalizes social listening / comment data to EvidenceSnippet.
 */

import type { EvidenceSourceAdapter } from './types.js'
import type { EvidenceSnippet } from '../angleContext.js'
import type { EvidenceFilter } from './types.js'

const SOURCE_ID = 'social_comments'

/** Adapter for social comments / listening. Stub until social API is wired. */
export const socialCommentsAdapter: EvidenceSourceAdapter = {
  sourceId: SOURCE_ID,

  async getEvidence(filter: EvidenceFilter): Promise<EvidenceSnippet[]> {
    const limit = filter.limit ?? 20
    const staticSamples = getStaticSocialSamples(filter.productOrUseCase)
    return staticSamples.slice(0, limit)
  },
}

function getStaticSocialSamples(productOrUseCase?: string): EvidenceSnippet[] {
  const base: EvidenceSnippet[] = [
    {
      id: 'social-1',
      text: 'Bundles get a lot of “gift idea” and “stocking stuffer” mentions in Q4.',
      source: SOURCE_ID,
      recency: new Date().toISOString().slice(0, 10),
      provenance: 'Social listening',
      tags: ['bundles', 'tof'],
    },
    {
      id: 'social-2',
      text: 'Switch messaging resonates when tied to “multiple environments” and versatility.',
      source: SOURCE_ID,
      recency: new Date().toISOString().slice(0, 10),
      provenance: 'Comment analysis',
      tags: ['switch', 'bau'],
    },
  ]
  if (productOrUseCase) {
    const q = productOrUseCase.toLowerCase()
    return base.filter((s) => s.tags?.some((t) => t.includes(q))) || base
  }
  return base
}
