/**
 * Dynamic evidence sources for angle generation.
 * Single retrieval interface: getEvidence(sources, filter) aggregates from selected adapters.
 */

import type { EvidenceSnippet } from '../angleContext.js'
import type { EvidenceSourceAdapter, EvidenceFilter } from './types.js'
import { metaAdapter } from './metaAdapter.js'
import { customerInsightsAdapter } from './customerInsightsAdapter.js'
import { socialCommentsAdapter } from './socialCommentsAdapter.js'
import { staticAdapter } from './staticAdapter.js'

export type { EvidenceSourceAdapter, EvidenceFilter } from './types.js'
export { metaAdapter } from './metaAdapter.js'
export { customerInsightsAdapter } from './customerInsightsAdapter.js'
export { socialCommentsAdapter } from './socialCommentsAdapter.js'
export { staticAdapter } from './staticAdapter.js'

/** Known adapter IDs for configuration. */
export const SOURCE_IDS = ['meta_ad_comment', 'customer_insights', 'social_comments', 'static_fallback'] as const

const adapterMap: Record<(typeof SOURCE_IDS)[number], EvidenceSourceAdapter> = {
  meta_ad_comment: metaAdapter,
  customer_insights: customerInsightsAdapter,
  social_comments: socialCommentsAdapter,
  static_fallback: staticAdapter,
}

/**
 * Fetch evidence from the given sources and merge into one list.
 * Deduplicates by snippet id; sorts by recency (newest first).
 */
export async function getEvidence(
  sourceIds: (typeof SOURCE_IDS)[number][] = ['static_fallback'],
  filter: EvidenceFilter = {}
): Promise<EvidenceSnippet[]> {
  const limit = filter.limit ?? 50
  const adapters = sourceIds
    .filter((id) => adapterMap[id])
    .map((id) => adapterMap[id])
  const results = await Promise.all(
    adapters.map((a) => a.getEvidence({ ...filter, limit: Math.ceil(limit / adapters.length) || 10 }))
  )
  const seen = new Set<string>()
  const merged: EvidenceSnippet[] = []
  for (const list of results) {
    for (const s of list) {
      if (!seen.has(s.id)) {
        seen.add(s.id)
        merged.push(s)
      }
    }
  }
  merged.sort((a, b) => (b.recency < a.recency ? -1 : b.recency > a.recency ? 1 : 0))
  return merged.slice(0, limit)
}
