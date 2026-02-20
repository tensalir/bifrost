/**
 * One-time seed: import Asset Forecast v3 workbook into forecast_runs + use case rows + FC/CS overrides + CS detail rows.
 * Usage: npx tsx scripts/seed-forecast-v3.ts [path-to-workbook.xlsx]
 * If no path given, requires FORECAST_WORKBOOK_PATH in .env or will exit with instructions.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseUseCaseDataSheet } from '../src/domain/forecast/parseUseCaseData'
import { FC_SHEET_PREFIX, CS_SHEET_PREFIX } from '../src/domain/forecast/workbookAudit'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
  process.exit(1)
}

const db = createClient(url, key)

function num(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).replace(/[€£$,\s]/g, '').replace(/%$/, '')
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

async function main() {
  const workbookPath = process.argv[2] ?? process.env.FORECAST_WORKBOOK_PATH
  if (!workbookPath) {
    console.error('Usage: npx tsx scripts/seed-forecast-v3.ts <path-to-Asset-Forecast-v3.xlsx>')
    console.error('Or set FORECAST_WORKBOOK_PATH in .env')
    process.exit(1)
  }

  const resolvedPath = join(process.cwd(), workbookPath)
  console.log('Reading workbook:', resolvedPath)
  const buf = readFileSync(resolvedPath)
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true })

  const { rows: useCaseRows, sheetNames, monthKeys } = parseUseCaseDataSheet(workbook)
  if (useCaseRows.length === 0) {
    console.error('No Use Case Data rows found. Ensure sheet "Use Case Data" exists.')
    process.exit(1)
  }

  const fcMonthKeys = monthKeys.filter((k) => !k.includes('TEMP'))
  console.log('Month keys (FC/CS):', fcMonthKeys.join(', '))
  console.log('Use Case Data rows:', useCaseRows.length)

  // Create single permanent run
  const runName = 'Asset Forecast v3 (seeded)'
  const { data: run, error: runErr } = await db
    .from('forecast_runs')
    .insert({
      name: runName,
      workbook_filename: 'Asset Forecast - v3.xlsx',
      sheet_names: sheetNames,
      month_keys: fcMonthKeys.length ? fcMonthKeys : monthKeys,
    })
    .select('id, name, month_keys')
    .single()

  if (runErr || !run?.id) {
    console.error('Failed to create forecast run:', runErr?.message)
    process.exit(1)
  }
  console.log('Created run:', run.id, run.name)

  const insertRows = useCaseRows.map((r, i) => ({
    run_id: run.id,
    row_index: i,
    year_num: r.year_num,
    month_date: r.month_date || null,
    use_case: r.use_case,
    graph_spent: r.graph_spent,
    graph_revenue: r.graph_revenue,
    roas: r.roas,
    results_spent: r.results_spent,
    spent_pct_total: r.spent_pct_total,
    forecasted_spent: r.forecasted_spent,
    forecasted_revenue: r.forecasted_revenue ?? null,
    raw_json: null,
  }))

  const { error: rowsErr } = await db.from('forecast_use_case_rows').insert(insertRows)
  if (rowsErr) {
    console.error('Failed to insert use case rows:', rowsErr.message)
    process.exit(1)
  }
  console.log('Inserted', insertRows.length, 'use case rows')

  // FC overrides per month
  for (const monthKey of fcMonthKeys) {
    const fcSheetName = `${FC_SHEET_PREFIX}${monthKey}`
    const sheet = workbook.Sheets[fcSheetName]
    if (!sheet) continue

    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false }) as unknown[][]
    const totalAdsNeeded = num(raw[2]?.[1]) || 525
    const adspendTargetGlobal = num(raw[4]?.[1])
    const adspendTargetExpansion = num(raw[5]?.[1])
    let creativeBudgetPct = num(raw[8]?.[1]) || 0.08
    if (creativeBudgetPct > 1) creativeBudgetPct = creativeBudgetPct / 100

    const m = num(raw[2]?.[9]) || 90
    const t = num(raw[3]?.[9]) || 10
    const y = num(raw[4]?.[9]) ?? 0
    const channelMix: Record<string, number> = {
      Meta: m > 1 ? m / 100 : m,
      'TikTok (Only UGC)': t > 1 ? t / 100 : t,
      Youtube: y > 1 ? y / 100 : y,
    }

    const useCaseBoost: Record<string, number> = {}
    for (let r = 21; r <= 52; r++) {
      const row = raw[r] ?? []
      const useCase = str(row[0])
      if (!useCase || useCase === 'TOTAL') continue
      const boost = num(row[4])
      if (boost > 0) useCaseBoost[useCase] = boost
    }

    const assetMixRows: Array<{ bucket: string; pct: number }> = []
    for (let r = 2; r <= 6; r++) {
      const row = raw[r] ?? []
      const bucket = str(row[3]) || str(row[2])
      if (!bucket || bucket === 'TOTAL') continue
      const pct = num(row[4])
      if (pct > 0) assetMixRows.push({ bucket, pct })
    }
    const assetMixJson = assetMixRows.length ? assetMixRows : null

    const funnelRows: Array<{ stage: string; pct: number }> = []
    for (let r = 10; r <= 13; r++) {
      const row = raw[r] ?? []
      const stage = str(row[3])
      if (!stage || stage === 'TOTAL') continue
      funnelRows.push({ stage, pct: num(row[4]) })
    }
    const funnelJson = funnelRows.length ? funnelRows : null

    const assetTypeRows: Array<{ assetType: string; pct: number }> = []
    for (let r = 10; r <= 14; r++) {
      const row = raw[r] ?? []
      const assetType = str(row[8]) || str(row[13])
      if (!assetType || assetType === 'TOTAL') continue
      assetTypeRows.push({ assetType, pct: num(row[9]) || num(row[14]) })
    }
    const assetTypeJson = assetTypeRows.length ? assetTypeRows : null

    const { error: fcErr } = await db.from('forecast_fc_overrides').upsert(
      {
        run_id: run.id,
        month_key: monthKey,
        total_ads_needed: totalAdsNeeded,
        adspend_target_global: adspendTargetGlobal || null,
        adspend_target_expansion: adspendTargetExpansion || null,
        creative_budget_pct: creativeBudgetPct,
        channel_mix_json: channelMix,
        use_case_boost_json: Object.keys(useCaseBoost).length ? useCaseBoost : null,
        asset_mix_json: assetMixJson,
        funnel_json: funnelJson,
        asset_type_json: assetTypeJson,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'run_id,month_key' }
    )

    if (fcErr) console.warn('FC override', monthKey, fcErr.message)
  }
  console.log('FC overrides created for', fcMonthKeys.length, 'months')

  // CS detail rows per month
  for (const monthKey of fcMonthKeys) {
    const csSheetName = `${CS_SHEET_PREFIX}${monthKey}`
    const sheet = workbook.Sheets[csSheetName]
    if (!sheet) continue

    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false }) as unknown[][]
    const dataStartRow = 17
    const detailRows: Array<{
      run_id: string
      month_key: string
      row_index: number
      siobhan_ref: string
      content_bucket: string
      static_count: number
      video_count: number
      carousel_count: number
      ideation_starter: string
      experiment_name: string
      notes: string
      type_use_case: string
      brief_owner: string
      localisation_or_growth: string
      studio_agency: string
      agency_ref: string
    }> = []

    for (let r = dataStartRow; r < raw.length; r++) {
      const row = raw[r] ?? []
      const siobhanRef = str(row[0])
      if (!siobhanRef) continue
      const contentBucket = str(row[1])
      const staticCount = Math.max(0, num(row[2]))
      const videoCount = Math.max(0, num(row[3]))
      const carouselCount = Math.max(0, num(row[4]))
      detailRows.push({
        run_id: run.id,
        month_key: monthKey,
        row_index: r - dataStartRow,
        siobhan_ref: siobhanRef,
        content_bucket: contentBucket || '',
        static_count: staticCount,
        video_count: videoCount,
        carousel_count: carouselCount,
        ideation_starter: str(row[5]) || '',
        experiment_name: str(row[6]) || '',
        notes: str(row[7]) || '',
        type_use_case: str(row[8]) || '',
        brief_owner: str(row[9]) || '',
        localisation_or_growth: str(row[10]) || '',
        studio_agency: str(row[11]) || '',
        agency_ref: str(row[12]) || '',
      })
    }

    if (detailRows.length > 0) {
      const { error: detailErr } = await db.from('forecast_cs_detail_rows').insert(detailRows)
      if (detailErr) console.warn('CS detail rows', monthKey, detailErr.message)
      else console.log('CS', monthKey, ':', detailRows.length, 'briefing rows')
    }
  }

  console.log('Seed complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
