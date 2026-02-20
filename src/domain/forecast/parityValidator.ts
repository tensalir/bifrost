/**
 * Parity validator: compare engine outputs to workbook cell values for control cells.
 * Produces a mismatch report for regression safety.
 */

import * as XLSX from 'xlsx'
import { computeFcOutput, computeCsOutput, type FcOutput, type CsOutput } from './parityEngine.js'
import type { ForecastUseCaseRow, UseCaseDataRow } from './schema.js'
import {
  getAllParityControlsForMonth,
  USE_CASE_DATA_SHEET,
  FC_SHEET_PREFIX,
  CS_SHEET_PREFIX,
} from './workbookAudit.js'
import { parseUseCaseDataSheet } from './parseUseCaseData.js'

export interface ParityMatch {
  sheet: string
  cell: string
  description: string
  expected: number | string
  actual: number | string
  match: true
}

export interface ParityMismatch {
  sheet: string
  cell: string
  description: string
  expected: number | string
  actual: number | string
  match: false
  delta?: number
}

export type ParityResult = ParityMatch | ParityMismatch

export interface ParityReport {
  monthKey: string
  matches: ParityMatch[]
  mismatches: ParityMismatch[]
  total: number
}

function getCellValue(ws: XLSX.WorkSheet, cellRef: string): number | string | null {
  const cell = ws[cellRef]
  if (!cell) return null
  const v = (cell as { v?: number | string }).v
  if (v === undefined || v === null) return null
  return typeof v === 'number' ? v : String(v)
}

function getExpectedFromEngine(
  sheet: string,
  cell: string,
  fc: FcOutput | null,
  cs: CsOutput | null,
  useCaseRows: ForecastUseCaseRow[]
): number | string | null {
  if (sheet === USE_CASE_DATA_SHEET) {
    const row = useCaseRows[2]
    if (!row) return null
    if (cell === 'E3') return row.graph_spent ?? row.results_spent ?? 0
    if (cell === 'G3') return row.roas ?? 0
    if (cell === 'I3') return row.spent_pct_total ?? 0
    return null
  }
  if (sheet.startsWith(FC_SHEET_PREFIX) && fc) {
    if (cell === 'B3') return fc.totalAdsNeeded
    if (cell === 'F3') return fc.assetMix[0]?.productionTarget ?? 0
    if (cell === 'E8') return fc.assetMix.reduce((s: number, r: FcOutput['assetMix'][0]) => s + r.pctAttribution, 0)
    if (cell === 'F8') return fc.assetMix.reduce((s: number, r: FcOutput['assetMix'][0]) => s + r.productionTarget, 0)
    if (cell === 'O11') return fc.assetType[0]?.pctAttribution ?? 0
    if (cell === 'P11') return fc.assetType[0]?.productionTarget ?? 0
    return null
  }
  if (sheet.startsWith(CS_SHEET_PREFIX) && cs) {
    if (cell === 'B8') return cs.contentBucketSummary[0]?.productionTargetUgcExcluded ?? 0
    if (cell === 'B9') return cs.contentBucketSummary[1]?.productionTargetUgcExcluded ?? 0
    if (cell === 'D8') return cs.contentBucketSummary[0]?.csSheet ?? 0
    if (cell === 'G3') return cs.studioAgencyTable[0]?.numAssets ?? 0
    return null
  }
  return null
}

function numericEqual(a: number | string, b: number | string, tolerance = 1e-6): boolean {
  const na = typeof a === 'number' ? a : Number(a)
  const nb = typeof b === 'number' ? b : Number(b)
  if (Number.isNaN(na) || Number.isNaN(nb)) return String(a) === String(b)
  return Math.abs(na - nb) <= tolerance
}

/**
 * Build parity report: run engine on use-case rows, read workbook cell values for control cells, compare.
 */
export function runParityCheck(
  workbook: XLSX.WorkBook,
  monthKey: string
): ParityReport {
  const controls = getAllParityControlsForMonth(monthKey)
  const { rows: useCaseRows } = parseUseCaseDataSheet(workbook)
  const useCaseRowsTyped: ForecastUseCaseRow[] = useCaseRows.map((r: UseCaseDataRow, i: number) => ({
    id: `row-${i}`,
    run_id: '',
    row_index: i,
    year_num: r.year_num,
    month_date: r.month_date,
    use_case: r.use_case,
    graph_spent: r.graph_spent,
    graph_revenue: r.graph_revenue,
    roas: r.roas,
    results_spent: r.results_spent,
    spent_pct_total: r.spent_pct_total,
    forecasted_spent: r.forecasted_spent,
    forecasted_revenue: r.forecasted_revenue ?? null,
    raw_json: null,
    created_at: new Date().toISOString(),
  }))

  const fc = computeFcOutput(monthKey, useCaseRowsTyped)
  const cs = computeCsOutput(fc)

  const matches: ParityMatch[] = []
  const mismatches: ParityMismatch[] = []

  for (const ctrl of controls) {
    const expected = getExpectedFromEngine(ctrl.sheet, ctrl.cell, fc, cs, useCaseRowsTyped)
    const ws = workbook.Sheets[ctrl.sheet]
    const actual = ws ? getCellValue(ws, ctrl.cell) : null
    const exp = expected ?? ''
    const act = actual ?? ''
    const match = expected != null && actual != null && numericEqual(exp, act)
    if (match) {
      matches.push({ sheet: ctrl.sheet, cell: ctrl.cell, description: ctrl.description, expected: exp, actual: act, match: true })
    } else {
      const delta = typeof exp === 'number' && typeof act === 'number' ? exp - act : undefined
      mismatches.push({
        sheet: ctrl.sheet,
        cell: ctrl.cell,
        description: ctrl.description,
        expected: exp,
        actual: act,
        match: false,
        delta,
      })
    }
  }

  return {
    monthKey,
    matches,
    mismatches,
    total: controls.length,
  }
}
