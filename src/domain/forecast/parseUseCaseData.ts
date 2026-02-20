/**
 * Parse "Use Case Data" sheet from workbook into normalized rows.
 * Row 2 = headers (Year, Month, UseCase, ...), data from row 3.
 */

import * as XLSX from 'xlsx'
import type { UseCaseDataRow } from './schema.js'
import { USE_CASE_DATA_SHEET } from './workbookAudit.js'

function num(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const n = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isNaN(n) ? 0 : n
}

function dateStr(v: unknown): string {
  if (v == null || v === '') return ''
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

export interface ParseResult {
  rows: UseCaseDataRow[]
  sheetNames: string[]
  monthKeys: string[]
}

/**
 * Extract month keys from sheet names (FC-May26 -> May26, etc.).
 */
export function extractMonthKeys(sheetNames: string[]): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const name of sheetNames) {
    if (name.startsWith('FC-')) {
      const key = name.slice(3)
      if (key && !seen.has(key)) {
        seen.add(key)
        keys.push(key)
      }
    }
  }
  return keys.sort()
}

/**
 * Parse Use Case Data sheet. Uses data_only style for computed values (we do not evaluate formulas here;
 * engine will recompute). Reads raw values; engine replicates formulas.
 */
export function parseUseCaseDataSheet(workbook: XLSX.WorkBook): ParseResult {
  const sheet = workbook.Sheets[USE_CASE_DATA_SHEET]
  const sheetNames = workbook.SheetNames ?? []
  const monthKeys = extractMonthKeys(sheetNames)

  if (!sheet) {
    return { rows: [], sheetNames, monthKeys }
  }

  const raw = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  }) as unknown[][]

  const rows: UseCaseDataRow[] = []
  const headerRow = raw[1] ?? []
  const colIndex: Record<string, number> = {}
  const headers = ['Year', 'Month', 'UseCase', 'Graph. Spent', 'Graph. Revenue', 'ROAS', 'Results Spent', 'Spent % total (per year)', 'Forecasted Spent']
  headers.forEach((h, i) => {
    const idx = headerRow.findIndex((c) => String(c).trim().toLowerCase().includes(h.toLowerCase().slice(0, 5)))
    if (idx >= 0) colIndex[h] = idx
    else if (i < 9) colIndex[h] = i + 1
  })

  const yearCol = colIndex['Year'] ?? 1
  const monthCol = colIndex['Month'] ?? 2
  const useCaseCol = colIndex['UseCase'] ?? 3
  const graphSpentCol = colIndex['Graph. Spent'] ?? 4
  const graphRevenueCol = colIndex['Graph. Revenue'] ?? 5
  const roasCol = colIndex['ROAS'] ?? 6
  const resultsSpentCol = colIndex['Results Spent'] ?? 7
  const spentPctCol = colIndex['Spent % total (per year)'] ?? 8
  const forecastedSpentCol = colIndex['Forecasted Spent'] ?? 9

  for (let r = 2; r < raw.length; r++) {
    const rowArr = (raw[r] ?? []) as unknown[]
    const useCase = String(rowArr[useCaseCol] ?? '').trim()
    if (!useCase) continue

    const yearVal = rowArr[yearCol]
    const yearNum = typeof yearVal === 'number' ? Math.floor(yearVal) : num(yearVal)
    if (yearNum < 2000 || yearNum > 2100) continue
    const monthVal = rowArr[monthCol]
    const monthDate = dateStr(monthVal) || (monthVal ? String(monthVal).slice(0, 10) : '')

    const resultsSpent = num(rowArr[resultsSpentCol])
    const graphSpent = num(rowArr[graphSpentCol])
    const graphRevenue = num(rowArr[graphRevenueCol])
    const roas = num(rowArr[roasCol])
    const spentPct = num(rowArr[spentPctCol])
    const forecastedSpent = num(rowArr[forecastedSpentCol])
    const forecastedRevenue = num(rowArr[12])

    rows.push({
      year_num: yearNum,
      month_date: monthDate,
      use_case: useCase,
      graph_spent: graphSpent || resultsSpent,
      graph_revenue: graphRevenue,
      roas: roas || (graphSpent ? graphRevenue / graphSpent : 0),
      results_spent: resultsSpent,
      spent_pct_total: spentPct,
      forecasted_spent: forecastedSpent,
      forecasted_revenue: forecastedRevenue,
    })
  }

  return { rows, sheetNames, monthKeys }
}
