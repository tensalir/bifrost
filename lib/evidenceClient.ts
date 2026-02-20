/**
 * Server-side evidence retrieval: Voyage query embedding + Supabase match_evidence_chunks RPC.
 * Used by briefing assistant adapters; only call from API routes (service key).
 */

import { getSupabase } from './supabase.js'

const VOYAGE_EMBED_API = 'https://api.voyageai.com/v1/embeddings'
const EMBED_DIM = 1024

export interface MatchEvidenceParams {
  query: string
  matchCount?: number
  similarityThreshold?: number
  datasetId?: string | null
  datasourceId?: string | null
  productOrUseCase?: string | null
  since?: string | null
}

export interface EvidenceChunkRow {
  id: string
  dataset_id: string
  datasource_id: string
  product_or_use_case: string | null
  content: string
  source_row_id: string | null
  recency: string | null
  context_json: Record<string, unknown> | null
  similarity: number
}

/** Generate query embedding via Voyage (server-side). Returns null if Voyage is not configured. */
export async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const key = process.env.VOYAGE_API_KEY
  if (!key) return null
  const res = await fetch(VOYAGE_EMBED_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      input: query,
      model: 'voyage-3.5',
      input_type: 'query',
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { data?: Array<{ embedding: number[] }> }
  const emb = data.data?.[0]?.embedding
  if (!emb || emb.length !== EMBED_DIM) return null
  return emb
}

/** Run vector search and return matching chunks. Returns [] if Supabase or Voyage unavailable. */
export async function matchEvidenceChunks(params: MatchEvidenceParams): Promise<EvidenceChunkRow[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const embedding = await getQueryEmbedding(params.query)
  if (!embedding) return []

  const { data, error } = await supabase.rpc('match_evidence_chunks', {
    query_embedding: embedding,
    match_count: params.matchCount ?? 15,
    similarity_threshold: params.similarityThreshold ?? 0.3,
    filter_dataset_id: params.datasetId ?? null,
    filter_datasource_id: params.datasourceId ?? null,
    filter_product: params.productOrUseCase ?? null,
    filter_since: params.since ?? null,
  })
  if (error) return []
  return (data ?? []) as EvidenceChunkRow[]
}

/** Check if live evidence retrieval is available (Supabase + Voyage). */
export function isEvidenceRetrievalAvailable(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && process.env.VOYAGE_API_KEY)
}
