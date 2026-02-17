/**
 * Meta (ads/creative) evidence adapter.
 * Normalizes Meta API or export data to EvidenceSnippet for angle generation.
 */

import type { EvidenceSourceAdapter } from './types.js'
import type { EvidenceSnippet } from '../angleContext.js'
import type { EvidenceFilter } from './types.js'

const SOURCE_ID = 'meta_ad_comment'

/** Adapter for Meta ad comments / creative feedback. Stub until Meta API is wired. */
export const metaAdapter: EvidenceSourceAdapter = {
  sourceId: SOURCE_ID,

  async getEvidence(filter: EvidenceFilter): Promise<EvidenceSnippet[]> {
    const limit = filter.limit ?? 20
    // Stub: no Meta API in repo yet. Return empty or static samples for continuity.
    const staticSamples = getStaticMetaSamples(filter.productOrUseCase)
    return staticSamples.slice(0, limit)
  },
}

function getStaticMetaSamples(productOrUseCase?: string): EvidenceSnippet[] {
  const base: EvidenceSnippet[] = [
    {
      id: 'meta-1',
      text: 'People respond well to quiet moments in ads—less noise, more focus on the product.',
      source: SOURCE_ID,
      recency: new Date().toISOString().slice(0, 10),
      provenance: 'Meta ad comment summary',
      tags: ['quiet', 'tof'],
    },
    {
      id: 'meta-2',
      text: 'Dream positioning tests show strong engagement when we lead with benefit over feature.',
      source: SOURCE_ID,
      recency: new Date().toISOString().slice(0, 10),
      provenance: 'Meta creative test',
      tags: ['dream', 'bau'],
    },
  ]
  if (productOrUseCase) {
    const q = productOrUseCase.toLowerCase()
    return base.filter((s) => s.tags?.some((t) => t.includes(q))) || base
  }
  return base
}
