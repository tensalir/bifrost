/**
 * Ingest Meta ad performance CSV into evidence_datasets + evidence_chunks with Voyage embeddings.
 * Idempotent by content_hash; resumable via evidence_ingestion_runs checkpoint.
 *
 * Usage:
 *   npx tsx src/scripts/ingest-meta-ad-csv.ts <path-to.csv> [--dry-run]
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, VOYAGE_API_KEY
 */

import 'dotenv/config'
import { createReadStream } from 'node:fs'
import { parse } from 'csv-parse'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  datasetKeyFromFilename,
  normalizeRow,
  contentHash,
  EVIDENCE_DATASOURCE_ID,
  type NormalizedEvidenceRow,
  type MetaCsvColumnMap,
} from '../domain/briefingAssistant/evidence/metaCsvTransform.js'

const VOYAGE_EMBED_API = 'https://api.voyageai.com/v1/embeddings'
const BATCH_SIZE = 50
const EMBED_DIM = 1024

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getVoyageEmbedding(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(VOYAGE_EMBED_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      input: text,
      model: 'voyage-3.5',
      input_type: 'document',
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Voyage API ${res.status}: ${t}`)
  }
  const data = (await res.json()) as { data: Array<{ embedding: number[] }> }
  const emb = data.data?.[0]?.embedding
  if (!emb || emb.length !== EMBED_DIM) throw new Error(`Voyage returned invalid embedding (length ${emb?.length ?? 0})`)
  return emb
}

async function getVoyageEmbeddingsBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch(VOYAGE_EMBED_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      input: texts,
      model: 'voyage-3.5',
      input_type: 'document',
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Voyage API ${res.status}: ${t}`)
  }
  const data = (await res.json()) as { data: Array<{ embedding: number[] }> }
  const list = data.data ?? []
  if (list.length !== texts.length) throw new Error(`Voyage returned ${list.length} embeddings, expected ${texts.length}`)
  return list.map((d) => d.embedding)
}

async function ensureDataset(
  supabase: SupabaseClient,
  datasetKey: string,
  sourceFilename: string,
  extractedAt: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('evidence_datasets')
    .select('id')
    .eq('dataset_key', datasetKey)
    .maybeSingle()
  if (existing) return existing.id
  const { data: inserted, error } = await supabase
    .from('evidence_datasets')
    .insert({ dataset_key: datasetKey, source_filename: sourceFilename, extracted_at: extractedAt })
    .select('id')
    .single()
  if (error) throw new Error(`Insert dataset: ${error.message}`)
  return inserted.id
}

async function upsertChunks(
  supabase: SupabaseClient,
  datasetId: string,
  rows: NormalizedEvidenceRow[],
  embeddings: number[][]
): Promise<void> {
  if (rows.length !== embeddings.length) throw new Error('Rows and embeddings length mismatch')
  const rows_ = rows.map((r, i) => ({
    dataset_id: datasetId,
    datasource_id: EVIDENCE_DATASOURCE_ID,
    product_or_use_case: r.productOrUseCase,
    content: r.content,
    content_hash: contentHash(r.content, r.sourceRowId),
    embedding: embeddings[i],
    source_row_id: r.sourceRowId,
    recency: r.recency,
    context_json: r.contextJson,
  }))
  const { error } = await supabase.from('evidence_chunks').upsert(rows_, {
    onConflict: 'dataset_id,content_hash',
    ignoreDuplicates: false,
  })
  if (error) throw new Error(`Upsert chunks: ${error.message}`)
}

async function updateCheckpoint(
  supabase: SupabaseClient,
  datasetId: string,
  lastRowIndex: number,
  status: 'running' | 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  await supabase.from('evidence_ingestion_runs').upsert(
    {
      dataset_id: datasetId,
      status,
      last_row_index: lastRowIndex,
      error_message: errorMessage ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dataset_id' }
  )
}

async function main(): Promise<void> {
  const csvPath = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')
  if (!csvPath) {
    console.error('Usage: npx tsx src/scripts/ingest-meta-ad-csv.ts <path-to.csv> [--dry-run]')
    process.exit(1)
  }

  const fs = await import('node:fs')
  if (!fs.existsSync(csvPath)) {
    console.error('File not found:', csvPath)
    process.exit(1)
  }

  const filename = csvPath.replace(/^.*[\\/]/, '')
  const { datasetKey, extractedAt } = datasetKeyFromFilename(filename)
  console.log('Dataset key:', datasetKey, 'Extracted at:', extractedAt)
  if (dryRun) console.log('DRY RUN: no embeddings or DB writes')

  const columnMap: MetaCsvColumnMap = {}
  let rowIndex = 0
  const batch: NormalizedEvidenceRow[] = []
  let totalRows = 0
  let supabase: SupabaseClient | null = null
  let datasetId: string | null = null
  const voyageKey = process.env.VOYAGE_API_KEY

  let resumeFromIndex = 0
  if (!dryRun) {
    supabase = getSupabase()
    if (!supabase) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
      process.exit(1)
    }
    if (!voyageKey) {
      console.error('Missing VOYAGE_API_KEY')
      process.exit(1)
    }
    datasetId = await ensureDataset(supabase, datasetKey, filename, extractedAt)
    console.log('Dataset ID:', datasetId)
    const { data: run } = await supabase
      .from('evidence_ingestion_runs')
      .select('last_row_index')
      .eq('dataset_id', datasetId)
      .maybeSingle()
    if (run?.last_row_index != null && run.last_row_index > 0) {
      resumeFromIndex = run.last_row_index
      console.log('Resuming from row index', resumeFromIndex)
    } else {
      await updateCheckpoint(supabase, datasetId, 0, 'running')
    }
  }

  const parser = createReadStream(csvPath).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
  )

  for await (const row of parser) {
    if (rowIndex < resumeFromIndex) {
      rowIndex++
      continue
    }
    const record = row as Record<string, string>
    const normalized = normalizeRow(record, rowIndex, columnMap)
    if (!normalized.content.trim()) {
      rowIndex++
      continue
    }
    totalRows++
    batch.push(normalized)
    if (batch.length >= BATCH_SIZE) {
      if (dryRun) {
        console.log('Would embed and upsert batch at row index', rowIndex)
      } else {
        const texts = batch.map((r) => r.content)
        const embeddings = await getVoyageEmbeddingsBatch(texts, voyageKey!)
        await upsertChunks(supabase!, datasetId!, batch, embeddings)
        await updateCheckpoint(supabase!, datasetId!, rowIndex, 'running')
        console.log('Upserted batch ending at row', rowIndex)
      }
      batch.length = 0
    }
    rowIndex++
  }

  if (batch.length > 0 && !dryRun && supabase && datasetId) {
    const texts = batch.map((r) => r.content)
    const embeddings = await getVoyageEmbeddingsBatch(texts, voyageKey!)
    await upsertChunks(supabase, datasetId, batch, embeddings)
    await updateCheckpoint(supabase, datasetId, rowIndex, 'completed')
    console.log('Upserted final batch:', batch.length, 'chunks')
  } else if (dryRun) {
    console.log('Total rows parsed:', totalRows, 'Last row index:', rowIndex)
  } else if (batch.length > 0) {
    await updateCheckpoint(supabase!, datasetId!, rowIndex, 'completed')
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
