/**
 * Test vectors for split engine: January (210 assets / 53 briefs), March (412 assets).
 * Run with: npx tsx src/domain/briefingAssistant/splitEngine.test.ts
 */

import { runSplit } from './splitEngine.js'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

const jan = runSplit({
  batchKey: '2026-01',
  batchLabel: 'January 2026',
  totalAssets: 210,
  maxBriefs: 53,
})

assert(jan.assignments.length === 53, `January: expected 53 briefs, got ${jan.assignments.length}`)
assert(
  jan.allocation.totalAssets === 210,
  `January: expected 210 total assets, got ${jan.allocation.totalAssets}`
)

const mar = runSplit({
  batchKey: '2026-03',
  batchLabel: 'March 2026',
  totalAssets: 412,
})

assert(
  mar.allocation.totalAssets === 412,
  `March: expected 412 total assets, got ${mar.allocation.totalAssets}`
)
assert(mar.assignments.length >= 1, `March: expected at least 1 brief, got ${mar.assignments.length}`)

console.log('Split engine test vectors: OK')
console.log('January:', jan.assignments.length, 'briefs', jan.allocation.totalAssets, 'assets')
console.log('March:', mar.assignments.length, 'briefs', mar.allocation.totalAssets, 'assets')
