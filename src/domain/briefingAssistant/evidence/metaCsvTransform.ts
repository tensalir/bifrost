/**
 * Transform Meta ad performance CSV rows into evidence chunks for RAG.
 * Column mapping is configurable so we can adapt to different export shapes without reading the full file.
 */

import { createHash } from 'node:crypto'

export const EVIDENCE_DATASOURCE_ID = 'ad_performance' as const

/** Normalized evidence row derived from a CSV row. */
export interface NormalizedEvidenceRow {
  productOrUseCase: string
  recency: string
  content: string
  sourceRowId: string
  contextJson: Record<string, unknown>
}

/** Configurable column names for the Meta CSV (override if your export uses different headers). */
export interface MetaCsvColumnMap {
  product?: string
  useCase?: string
  date?: string
  /** If set, only these columns (plus product/useCase/date) are used for content; otherwise all except product/useCase/date. */
  metricColumns?: string[]
}

const DEFAULT_COLUMN_MAP: MetaCsvColumnMap = {
  product: 'Product',
  useCase: 'Use case',
  date: 'Date',
}

/** Normalize a product/use-case value for filtering (lowercase, trimmed). */
export function normalizeProductOrUseCase(value: string): string {
  return (value ?? '').toString().trim().toLowerCase() || 'unknown'
}

/** Build a short content string from a CSV row for embedding (one chunk per row or aggregate). */
export function rowToChunkContent(row: Record<string, string>, columnMap: MetaCsvColumnMap = DEFAULT_COLUMN_MAP): string {
  const product = (row[columnMap.product ?? 'Product'] ?? row['product'] ?? '').trim()
  const useCase = (row[columnMap.useCase ?? 'Use case'] ?? row['use_case'] ?? '').trim()
  const date = (row[columnMap.date ?? 'Date'] ?? row['date'] ?? '').trim()
  const parts: string[] = []
  if (product) parts.push(`Product: ${product}`)
  if (useCase) parts.push(`Use case: ${useCase}`)
  if (date) parts.push(`Date: ${date}`)
  const metricCols = columnMap.metricColumns ?? Object.keys(row).filter((k) => !['Product', 'Use case', 'Date', 'product', 'use_case', 'date'].includes(k))
  for (const col of metricCols) {
    const v = row[col]
    if (v != null && String(v).trim()) parts.push(`${col}: ${String(v).trim()}`)
  }
  return parts.join('. ')
}

/** Build deterministic content hash for idempotent upserts. */
export function contentHash(content: string, sourceRowId: string): string {
  return createHash('sha256').update(`${sourceRowId}:${content}`).digest('hex')
}

/** Convert a CSV row (record of string values) into a normalized evidence row. */
export function normalizeRow(
  row: Record<string, string>,
  rowIndex: number,
  columnMap: MetaCsvColumnMap = DEFAULT_COLUMN_MAP
): NormalizedEvidenceRow {
  const product = (row[columnMap.product ?? 'Product'] ?? row['product'] ?? '').trim()
  const useCase = (row[columnMap.useCase ?? 'Use case'] ?? row['use_case'] ?? '').trim()
  const date = (row[columnMap.date ?? 'Date'] ?? row['date'] ?? '').trim()
  const productOrUseCase = normalizeProductOrUseCase(product || useCase || 'general')
  const content = rowToChunkContent(row, columnMap)
  const sourceRowId = `row-${rowIndex}`
  const contextJson: Record<string, unknown> = { rowIndex, date: date || null }
  if (product) contextJson.product = product
  if (useCase) contextJson.useCase = useCase
  return {
    productOrUseCase,
    recency: date || new Date().toISOString().slice(0, 10),
    content,
    sourceRowId,
    contextJson,
  }
}

/** Derive dataset_key and extracted_at from filename (e.g. "Meta ad data_2026-02-16-1325.csv" -> key + date). */
export function datasetKeyFromFilename(filename: string): { datasetKey: string; extractedAt: string } {
  const base = filename.replace(/\.csv$/i, '').trim()
  const datasetKey = base || 'meta-ad-data'
  const match = base.match(/(\d{4})-(\d{2})-(\d{2})/)
  const extractedAt = match ? `${match[1]}-${match[2]}-${match[3]}T12:00:00Z` : new Date().toISOString()
  return { datasetKey, extractedAt }
}
