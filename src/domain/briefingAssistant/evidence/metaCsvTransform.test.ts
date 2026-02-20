/**
 * Tests for Meta CSV transform (normalizeRow, contentHash, datasetKeyFromFilename).
 * Run with: npx tsx src/domain/briefingAssistant/evidence/metaCsvTransform.test.ts
 */

import {
  normalizeProductOrUseCase,
  rowToChunkContent,
  contentHash,
  normalizeRow,
  datasetKeyFromFilename,
  EVIDENCE_DATASOURCE_ID,
} from './metaCsvTransform.js'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

assert(normalizeProductOrUseCase('  Quiet  ') === 'quiet', 'normalizeProduct trims and lowercases')
assert(normalizeProductOrUseCase('') === 'unknown', 'empty -> unknown')

const row: Record<string, string> = { Product: 'Quiet', 'Use case': 'focus', Date: '2026-02-16', CTR: '2.5%' }
const content = rowToChunkContent(row)
assert(content.includes('Product: Quiet'), 'content includes product')
assert(content.includes('CTR: 2.5%'), 'content includes metric column')

const h1 = contentHash('same', 'row-0')
const h2 = contentHash('same', 'row-0')
const h3 = contentHash('same', 'row-1')
assert(h1 === h2, 'contentHash deterministic for same input')
assert(h1 !== h3, 'contentHash different for different sourceRowId')

const normalized = normalizeRow(row, 42)
assert(normalized.productOrUseCase === 'quiet', 'normalized productOrUseCase')
assert(normalized.sourceRowId === 'row-42', 'sourceRowId')
assert(normalized.recency === '2026-02-16', 'recency from date column')
assert(normalized.content === content, 'content matches rowToChunkContent')

const { datasetKey, extractedAt } = datasetKeyFromFilename('Meta ad data_2026-02-16-1325.csv')
assert(datasetKey === 'Meta ad data_2026-02-16-1325', 'datasetKey from filename')
assert(extractedAt.startsWith('2026-02-16'), 'extractedAt from filename date')

assert(EVIDENCE_DATASOURCE_ID === 'ad_performance', 'EVIDENCE_DATASOURCE_ID')

console.log('metaCsvTransform test: OK')
console.log('datasetKeyFromFilename("Meta ad data_2026-02-16-1325.csv") ->', { datasetKey, extractedAt })
console.log('normalizeRow sample ->', { productOrUseCase: normalized.productOrUseCase, sourceRowId: normalized.sourceRowId })
console.log('contentHash("hello","row-0") ->', contentHash('hello', 'row-0').slice(0, 16) + '...')