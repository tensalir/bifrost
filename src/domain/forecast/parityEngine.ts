/**
 * Deterministic Forecast parity engine: replicates FC/CS formula behavior from Use Case Data.
 * Supports FC/CS overrides for full spreadsheet parity (header, mix %, manual boost, production tables).
 */

import type { ForecastUseCaseRow, ForecastFcOverride } from './schema.js'
import {
  CONTENT_BUCKETS,
  ASSET_TYPES,
  FUNNEL_STAGES,
  KNOWN_USE_CASES,
} from './workbookAudit.js'

export interface FcAssetMixRow {
  bucket: string
  pctAttribution: number
  productionTarget: number
  forecasted: number
  static: number
  carousel: number
  video: number
  ugc: number
  partnershipCode: number
}

export interface FcFunnelRow {
  stage: string
  pctAttribution: number
  productionTarget: number
  forecasted: number
}

export interface FcAssetTypeRow {
  assetType: string
  pctAttribution: number
  productionTarget: number
  forecasted: number
  csSheet: number
}

export interface FcUseCaseResultRow {
  useCase: string
  spend: number
  revenue: number
  roas: number
  manualBoost: number
  pctTotalSpend: number
  adsProduction: number
  expProduction: number
  type: 'BAU' | 'EXP' | 'CAM'
}

export interface FcChannelMixRow {
  channel: string
  pctAttribution: number
  productionTarget: number
}

export interface FcHeaderBlock {
  adspendTargetGlobal: number
  adspendTargetExpansion: number
  totalAdspendTarget: number
  creativeBudgetPct: number
  creativeBudgetGlobal: number
  creativeBudgetExpansion: number
  totalCreativeBudget: number
  blendedCostPerAsset: number
}

export interface FcOutput {
  monthKey: string
  monthLabel: string
  totalAdsNeeded: number
  headerBlock: FcHeaderBlock
  assetMix: FcAssetMixRow[]
  channelMix: FcChannelMixRow[]
  funnel: FcFunnelRow[]
  assetType: FcAssetTypeRow[]
  useCaseResults: FcUseCaseResultRow[]
  totalProductionTarget: number
  totalForecasted: number
}

export interface CsContentBucketRow {
  bucket: string
  productionTargetUgcExcluded: number
  forecastedUgcExcluded: number
  csSheet: number
}

export interface CsStudioAgencyRow {
  studioAgency: string
  numAssets: number
  byUseCase: Record<string, { static: number; carousel: number; video: number }>
}

export interface CsDetailRow {
  siobhanRef: string
  contentBucket: string
  static: number
  video: number
  carousel: number
  ideationStarter: string
  experimentName: string
  notes: string
  typeUseCase: string
  briefOwner: string
  studioAgency: string
  agencyRef: string
  numAssets: number
}

export interface CsOutput {
  monthKey: string
  monthLabel: string
  totalAssets: number
  contentBucketSummary: CsContentBucketRow[]
  studioAgencyTable: CsStudioAgencyRow[]
  detailRows: CsDetailRow[]
  formatSummary?: { static: number; carousel: number; video: number; total: number; fcForecasted: number }
}

const DEFAULT_ASSET_MIX_PCT: Record<string, number> = {
  BAU: 0.52,
  EXP: 0.08,
  'Campaigns / Product Launches': 0.27,
  Localisation: 0.05,
  Growth: 0.08,
}

const DEFAULT_FUNNEL_PCT: Record<string, number> = {
  TOF: 0.75,
  BOF: 0.2,
  RET: 0.05,
}

const DEFAULT_ASSET_TYPE_PCT: Record<string, number> = {
  Static: 0.38,
  Carousel: 0.08,
  Video: 0.22,
  UGC: 0.27,
  Partnership: 0.05,
}

const DEFAULT_CHANNEL_MIX: FcChannelMixRow[] = [
  { channel: 'Meta', pctAttribution: 0.9, productionTarget: 0 },
  { channel: 'TikTok (Only UGC)', pctAttribution: 0.1, productionTarget: 0 },
  { channel: 'Youtube', pctAttribution: 0, productionTarget: 0 },
]

const USE_CASE_TYPE: Record<string, 'BAU' | 'EXP' | 'CAM'> = {
  Bundles: 'EXP',
  Generic: 'BAU',
  Sleep: 'BAU',
  NoiseSensitive: 'BAU',
  Switch: 'EXP',
  Quiz: 'EXP',
  Festival: 'BAU',
  Focus: 'BAU',
  Kids: 'BAU',
  Comparison: 'EXP',
  Parenting: 'BAU',
  Wellness: 'BAU',
  DamagedHearing: 'BAU',
  Fashion: 'BAU',
  Hobbies: 'BAU',
  Reactive: 'BAU',
  SocialEvents: 'BAU',
  Sports: 'BAU',
  'Travel&Commuting': 'BAU',
  'Safety&Health@Work': 'BAU',
  BFCM: 'BAU',
  McLaren: 'CAM',
  Swarovski: 'CAM',
  Coachella: 'CAM',
  Tomorrowland: 'CAM',
  Eclipse: 'CAM',
  Hebe: 'CAM',
  'Harry Styles': 'CAM',
  'Switch Iridescent': 'CAM',
  Iridescent: 'CAM',
  Gifting: 'CAM',
  BestPerformers: 'BAU',
  Unboxing: 'EXP',
}

function round(x: number): number {
  return Math.round(x)
}

/** Parse monthKey (e.g. May26) to year and month number for date filtering */
function monthKeyToYearMonth(monthKey: string): { year: number; month: number } {
  const m = monthKey.slice(0, 3)
  const y = parseInt(monthKey.slice(3), 10)
  const year = y >= 50 ? 2000 + y : 1900 + y
  const monthMap: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Sept: 9, Oct: 10, Nov: 11, Dec: 12,
  }
  const month = monthMap[m] ?? 1
  return { year, month }
}

/** Last 12 months (inclusive) before the given year-month */
function last12MonthKeys(year: number, month: number): Array<{ year: number; month: number }> {
  const out: Array<{ year: number; month: number }> = []
  for (let i = 0; i < 12; i++) {
    let m = month - i
    let y = year
    while (m <= 0) {
      m += 12
      y -= 1
    }
    out.push({ year: y, month: m })
  }
  return out
}

function rowMatchesMonth(row: ForecastUseCaseRow, year: number, month: number): boolean {
  if (row.year_num !== year) return false
  if (!row.month_date) return false
  const s = String(row.month_date)
  const match = s.match(/^(\d{4})-(\d{1,2})/)
  if (match) return parseInt(match[1], 10) === year && parseInt(match[2], 10) === month
  const d = new Date(row.month_date)
  if (Number.isNaN(d.getTime())) return false
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month
}

export interface FcRunOptions {
  totalAdsNeeded?: number
  ugcPctExclude?: number
  fcOverride?: ForecastFcOverride | null
}

/**
 * Compute FC output for a month from use-case rows, with optional overrides.
 */
export function computeFcOutput(
  monthKey: string,
  useCaseRows: ForecastUseCaseRow[],
  options: FcRunOptions = {}
): FcOutput {
  const { fcOverride, ugcPctExclude = 0.27 } = options
  const totalAdsNeeded = options.totalAdsNeeded ?? fcOverride?.total_ads_needed ?? 525
  const monthLabel = monthKey.replace(/(\w{3})(\d{2})/, (_, m, y) => `${m}-${y}`)

  const adspendGlobal = fcOverride?.adspend_target_global ?? 0
  const adspendExpansion = fcOverride?.adspend_target_expansion ?? 0
  const totalAdspendTarget = adspendGlobal + adspendExpansion
  const creativeBudgetPct = (fcOverride?.creative_budget_pct ?? 0.08)
  const creativeBudgetGlobal = round(adspendGlobal * creativeBudgetPct)
  const creativeBudgetExpansion = round(adspendExpansion * creativeBudgetPct)
  const totalCreativeBudget = creativeBudgetGlobal + creativeBudgetExpansion
  const blendedCostPerAsset = totalAdsNeeded > 0 ? totalCreativeBudget / totalAdsNeeded : 0

  const headerBlock: FcHeaderBlock = {
    adspendTargetGlobal: adspendGlobal,
    adspendTargetExpansion: adspendExpansion,
    totalAdspendTarget,
    creativeBudgetPct,
    creativeBudgetGlobal,
    creativeBudgetExpansion,
    totalCreativeBudget,
    blendedCostPerAsset: round(blendedCostPerAsset * 100) / 100,
  }

  const assetMixPct: Record<string, number> = {}
  const mixArray = fcOverride?.asset_mix_json
  if (Array.isArray(mixArray)) {
    for (const r of mixArray) {
      const bucket = (r as { bucket?: string }).bucket
      const pct = (r as { pct?: number }).pct
      if (bucket != null && typeof pct === 'number') {
        assetMixPct[bucket] = pct > 1 ? pct / 100 : pct
      }
    }
  }
  if (Object.keys(assetMixPct).length === 0) {
    Object.assign(assetMixPct, DEFAULT_ASSET_MIX_PCT)
  }

  const assetMix: FcAssetMixRow[] = CONTENT_BUCKETS.map((bucket) => {
    const label = bucket === 'CAM' ? 'Campaigns / Product Launches' : bucket
    const pct = assetMixPct[label] ?? assetMixPct[bucket] ?? DEFAULT_ASSET_MIX_PCT[label] ?? 0
    const productionTarget = round(pct * totalAdsNeeded)
    return {
      bucket,
      pctAttribution: pct,
      productionTarget,
      forecasted: productionTarget,
      static: 0,
      carousel: 0,
      video: 0,
      ugc: 0,
      partnershipCode: 0,
    }
  })

  let channelMix: FcChannelMixRow[] = DEFAULT_CHANNEL_MIX.map((r) => ({
    ...r,
    productionTarget: round(r.pctAttribution * totalAdsNeeded),
  }))
  const chJson = fcOverride?.channel_mix_json
  if (chJson && typeof chJson === 'object' && !Array.isArray(chJson)) {
    const entries = Object.entries(chJson as Record<string, number>)
    if (entries.length > 0) {
      channelMix = entries.map(([channel, pct]) => ({
        channel,
        pctAttribution: pct > 1 ? pct / 100 : pct,
        productionTarget: round((pct > 1 ? pct / 100 : pct) * totalAdsNeeded),
      }))
    }
  }

  const funnelPct: Record<string, number> = {}
  const funnelArray = fcOverride?.funnel_json
  if (Array.isArray(funnelArray)) {
    for (const r of funnelArray) {
      const stage = (r as { stage?: string }).stage
      const pct = (r as { pct?: number }).pct
      if (stage != null && typeof pct === 'number') {
        funnelPct[stage] = pct > 1 ? pct / 100 : pct
      }
    }
  }
  if (Object.keys(funnelPct).length === 0) {
    Object.assign(funnelPct, DEFAULT_FUNNEL_PCT)
  }

  const funnel: FcFunnelRow[] = FUNNEL_STAGES.map((stage) => {
    const pct = funnelPct[stage] ?? 0
    const productionTarget = round(pct * totalAdsNeeded)
    return {
      stage,
      pctAttribution: pct,
      productionTarget,
      forecasted: productionTarget,
    }
  })

  const assetTypePct: Record<string, number> = {}
  const typeArray = fcOverride?.asset_type_json
  if (Array.isArray(typeArray)) {
    for (const r of typeArray) {
      const assetType = (r as { assetType?: string }).assetType
      const pct = (r as { pct?: number }).pct
      if (assetType != null && typeof pct === 'number') {
        const key = assetType === 'Partnership Code' ? 'Partnership' : assetType
        assetTypePct[key] = pct > 1 ? pct / 100 : pct
      }
    }
  }
  if (Object.keys(assetTypePct).length === 0) {
    Object.assign(assetTypePct, DEFAULT_ASSET_TYPE_PCT)
  }

  const assetType: FcAssetTypeRow[] = ASSET_TYPES.map((assetTypeName) => {
    const key = assetTypeName === 'Partnership Code' ? 'Partnership' : assetTypeName
    const pct = assetTypePct[key] ?? 0
    const productionTarget = round(pct * totalAdsNeeded)
    return {
      assetType: assetTypeName,
      pctAttribution: pct,
      productionTarget,
      forecasted: productionTarget,
      csSheet: 0,
    }
  })

  const { year, month } = monthKeyToYearMonth(monthKey)
  const last12 = last12MonthKeys(year, month)
  const rowsForMonth = useCaseRows.filter((r) =>
    last12.some(({ year: y, month: m }) => rowMatchesMonth(r, y, m))
  )

  const totalSpend = rowsForMonth.reduce(
    (s, r) => s + (r.results_spent ?? 0) + (r.forecasted_spent ?? 0),
    0
  )
  const useCaseBoostJson = (fcOverride?.use_case_boost_json ?? {}) as Record<string, number>

  const allUseCases = [...new Set([...KNOWN_USE_CASES, 'McLaren', 'Swarovski', 'Coachella', 'Tomorrowland', 'Hebe', 'Harry Styles', 'Switch Iridescent', 'Iridescent', 'Gifting'])]
  const useCaseResults: FcUseCaseResultRow[] = allUseCases.map((useCase) => {
    const rows = rowsForMonth.filter((r) => r.use_case === useCase)
    const spend = rows.reduce((s, r) => s + (r.results_spent ?? 0) + (r.forecasted_spent ?? 0), 0)
    const revenue = rows.reduce((s, r) => s + (r.graph_revenue ?? 0), 0)
    const roas = spend ? revenue / spend : 0
    const pctTotalSpend = totalSpend ? spend / totalSpend : 0
    const type = USE_CASE_TYPE[useCase] ?? 'BAU'
    const manualBoost = useCaseBoostJson[useCase] ?? 1
    const adsProduction =
      type === 'CAM'
        ? 0
        : round(pctTotalSpend * totalAdsNeeded * manualBoost * 0.5)
    const expProduction = type === 'EXP' ? adsProduction : 0
    return {
      useCase,
      spend,
      revenue,
      roas,
      manualBoost,
      pctTotalSpend,
      adsProduction,
      expProduction,
      type,
    }
  }).filter((r) => r.spend > 0 || r.revenue > 0 || r.adsProduction > 0)

  const totalProductionTarget = assetMix.reduce((s, r) => s + r.productionTarget, 0)
  const totalForecasted = assetMix.reduce((s, r) => s + r.forecasted, 0)

  return {
    monthKey,
    monthLabel,
    totalAdsNeeded,
    headerBlock,
    assetMix,
    channelMix,
    funnel,
    assetType,
    useCaseResults,
    totalProductionTarget,
    totalForecasted,
  }
}

/**
 * Compute CS output from FC output and optional detail rows.
 */
export function computeCsOutput(
  fc: FcOutput,
  options: {
    studioAgencyNames?: string[]
    detailRows?: CsDetailRow[]
    ugcPctExclude?: number
  } = {}
): CsOutput {
  const { studioAgencyNames = [], detailRows = [], ugcPctExclude = 0.27 } = options

  const contentBucketSummary: CsContentBucketRow[] = fc.assetMix.map((row) => {
    const productionTargetUgcExcluded = round(row.productionTarget * (1 - ugcPctExclude))
    const forecastedUgcExcluded = row.static + row.carousel + row.video + row.partnershipCode
    const csSheet = detailRows
      .filter((d) => d.contentBucket === row.bucket)
      .reduce((s, d) => s + d.static + d.video + d.carousel, 0)
    return {
      bucket: row.bucket,
      productionTargetUgcExcluded,
      forecastedUgcExcluded,
      csSheet,
    }
  })

  const studioAgencyTable: CsStudioAgencyRow[] = studioAgencyNames.map((name) => {
    const numAssets = detailRows
      .filter((d) => d.studioAgency === name)
      .reduce((s, d) => s + d.static + d.video + d.carousel, 0)
    return {
      studioAgency: name,
      numAssets,
      byUseCase: {},
    }
  })

  const totalAssets = detailRows.reduce((s, d) => s + d.static + d.video + d.carousel, 0)

  const fcStatic = fc.assetType.find((a) => a.assetType === 'Static')?.forecasted ?? 0
  const fcCarousel = fc.assetType.find((a) => a.assetType === 'Carousel')?.forecasted ?? 0
  const fcVideo = fc.assetType.find((a) => a.assetType === 'Video')?.forecasted ?? 0
  const fcForecasted = fcStatic + fcCarousel + fcVideo
  const formatSummary = {
    static: detailRows.reduce((s, d) => s + d.static, 0),
    carousel: detailRows.reduce((s, d) => s + d.carousel, 0),
    video: detailRows.reduce((s, d) => s + d.video, 0),
    total: totalAssets,
    fcForecasted,
  }

  return {
    monthKey: fc.monthKey,
    monthLabel: fc.monthLabel,
    totalAssets,
    contentBucketSummary,
    studioAgencyTable,
    detailRows,
    formatSummary,
  }
}
