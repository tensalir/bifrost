/**
 * Forecast domain: run, use-case rows, FC/CS computed and override types.
 */

import { z } from 'zod'

export interface ForecastRun {
  id: string
  name: string | null
  uploaded_at: string
  workbook_filename: string | null
  sheet_names: string[]
  month_keys: string[]
  created_at: string
}

export interface ForecastUseCaseRow {
  id: string
  run_id: string
  row_index: number
  year_num: number | null
  month_date: string | null
  use_case: string
  graph_spent: number | null
  graph_revenue: number | null
  roas: number | null
  results_spent: number | null
  spent_pct_total: number | null
  forecasted_spent: number | null
  forecasted_revenue: number | null
  raw_json: Record<string, unknown> | null
  created_at: string
}

export interface ForecastFcOverride {
  id: string
  run_id: string
  month_key: string
  total_ads_needed: number | null
  adspend_target_global: number | null
  adspend_target_expansion: number | null
  creative_budget_pct: number | null
  channel_mix_json: Record<string, number> | Array<{ channel: string; pct: number }> | null
  use_case_boost_json: Record<string, number> | null
  asset_mix_json: Record<string, unknown> | Array<{ bucket: string; pct: number }> | null
  funnel_json: Record<string, unknown> | Array<{ stage: string; pct: number }> | null
  asset_type_json: Record<string, unknown> | Array<{ assetType: string; pct: number }> | null
  asset_production_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ForecastCsOverride {
  id: string
  run_id: string
  month_key: string
  studio_agency_json: Record<string, unknown> | null
  detail_rows_json: unknown[] | null
  created_at: string
  updated_at: string
}

/** Normalized row from Use Case Data sheet (for import). */
export interface UseCaseDataRow {
  year_num: number
  month_date: string
  use_case: string
  graph_spent: number
  graph_revenue: number
  roas: number
  results_spent: number
  spent_pct_total: number
  forecasted_spent: number
  forecasted_revenue?: number
}

export const UseCaseDataRowSchema = z.object({
  year_num: z.number(),
  month_date: z.string(),
  use_case: z.string(),
  graph_spent: z.number(),
  graph_revenue: z.number(),
  roas: z.number(),
  results_spent: z.number(),
  spent_pct_total: z.number(),
  forecasted_spent: z.number(),
  forecasted_revenue: z.number().optional(),
})

export const ForecastImportResponseSchema = z.object({
  ok: z.literal(true),
  runId: z.string(),
  runName: z.string().nullable(),
  monthKeys: z.array(z.string()),
  sheetNames: z.array(z.string()),
  useCaseRowCount: z.number(),
})
