/**
 * Meta (ads/creative) evidence adapter.
 * Uses Supabase RAG when configured; otherwise static fallback for continuity.
 */

import type { EvidenceSourceAdapter } from './types.js'
import type { EvidenceSnippet } from '../angleContext.js'
import type { EvidenceFilter } from './types.js'
import { matchEvidenceChunks, isEvidenceRetrievalAvailable, type EvidenceChunkRow } from '@/lib/evidenceClient.js'

const SOURCE_ID = 'meta_ad_comment'
const CANONICAL_DATASOURCE_ID = 'ad_performance'

/** Adapter for Meta ad performance / creative feedback. Live when evidence RAG is configured. */
export const metaAdapter: EvidenceSourceAdapter = {
  sourceId: SOURCE_ID,

  async getEvidence(filter: EvidenceFilter): Promise<EvidenceSnippet[]> {
    const limit = filter.limit ?? 20
    const productOrUseCase = filter.productOrUseCase?.trim()
    const since = filter.since ?? undefined

    if (isEvidenceRetrievalAvailable()) {
      const query = [productOrUseCase, 'ad performance', 'creative', 'metrics'].filter(Boolean).join(' ')
      const rows = await matchEvidenceChunks({
        query,
        matchCount: limit,
        datasourceId: CANONICAL_DATASOURCE_ID,
        productOrUseCase: productOrUseCase || undefined,
        since: since || undefined,
      })
      return rows.map((r: EvidenceChunkRow) => ({
        id: r.id,
        text: r.content,
        source: SOURCE_ID,
        recency: r.recency ?? new Date().toISOString().slice(0, 10),
        provenance: r.source_row_id ? `Evidence row ${r.source_row_id}` : undefined,
        tags: r.product_or_use_case ? [r.product_or_use_case] : undefined,
      }))
    }
    return getStaticMetaSamples(productOrUseCase).slice(0, limit)
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
