/**
 * Static fallback adapter for evidence when no live sources are configured.
 * Ensures angle generation has continuity with a fixed dataset.
 */

import type { EvidenceSourceAdapter } from './types.js'
import type { EvidenceSnippet } from '../angleContext.js'
import type { EvidenceFilter } from './types.js'

const SOURCE_ID = 'static_fallback'

/** Static dataset adapter. Used when Meta/insights/social are not available. */
export const staticAdapter: EvidenceSourceAdapter = {
  sourceId: SOURCE_ID,

  async getEvidence(filter: EvidenceFilter): Promise<EvidenceSnippet[]> {
    const limit = filter.limit ?? 30
    const all = getStaticDataset(filter.productOrUseCase, filter.since)
    return all.slice(0, limit)
  },
}

function getStaticDataset(productOrUseCase?: string, since?: string): EvidenceSnippet[] {
  const snippets: EvidenceSnippet[] = [
    { id: 's1', text: 'Quiet positioning: focus on noise reduction benefit.', source: SOURCE_ID, recency: '2026-01-15', tags: ['quiet'] },
    { id: 's2', text: 'Dream: sleep and wind-down use cases perform well.', source: SOURCE_ID, recency: '2026-01-14', tags: ['dream'] },
    { id: 's3', text: 'Bundles: gift and multi-pack messaging drives TOF.', source: SOURCE_ID, recency: '2026-01-13', tags: ['bundles'] },
    { id: 's4', text: 'Switch: versatility across environments is a key message.', source: SOURCE_ID, recency: '2026-01-12', tags: ['switch'] },
    { id: 's5', text: 'Engage kids: parents look for safe, fun positioning.', source: SOURCE_ID, recency: '2026-01-11', tags: ['engage', 'engage_kids'] },
  ]
  let out = snippets
  if (productOrUseCase) {
    const q = productOrUseCase.toLowerCase()
    out = snippets.filter((s) => s.tags?.some((t) => t.includes(q))) || snippets
  }
  if (since) {
    out = out.filter((s) => s.recency >= since)
  }
  return out
}
