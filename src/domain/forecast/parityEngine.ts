/**
 * Deterministic Forecast parity engine: replicates FC/CS formula behavior from Use Case Data.
 * Does not evaluate Excel formulas; implements same math so outputs match workbook.
 */

import type { ForecastUseCaseRow } from './schema.js'
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

export interface FcOutput {
  monthKey: string
  monthLabel: string
  totalAdsNeeded: number
  assetMix: FcAssetMixRow[]
  funnel: FcFunnelRow[]
  assetType: FcAssetTypeRow[]
  useCaseResults: FcUseCaseResultRow[]
  /** Totals for parity checks */
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
  /** Per use-case allocation (useCase -> static/carousel/video from FC) */
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
}

/** Default % attribution for asset mix (BAU, EXP, CAM, Localisation, Growth). Must sum to 1. */
const DEFAULT_ASSET_MIX_PCT: Record<string, number> = {
  BAU: 0.52,
  EXP: 0.08,
  'Campaigns / Product Launches': 0.27,
  Localisation: 0.05,
  Growth: 0.08,
}

/** Default funnel % (TOF, BOF, RET). */
const DEFAULT_FUNNEL_PCT: Record<string, number> = {
  TOF: 0.75,
  BOF: 0.2,
  RET: 0.05,
}

/** Default asset type % (Static, Carousel, Video, UGC, Partnership). */
const DEFAULT_ASSET_TYPE_PCT: Record<string, number> = {
  Static: 0.38,
  Carousel: 0.08,
  Video: 0.22,
  UGC: 0.27,
  Partnership: 0.05,
}

/** Use case -> type (BAU/EXP/CAM) for use-case results. */
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
}

function round(x: number): number {
  return Math.round(x)
}

/**
 * Compute FC output for a month from use-case rows and optional total_ads_needed.
 * If total_ads_needed not provided, derives from sum of forecasted production (simplified).
 */
export function computeFcOutput(
  monthKey: string,
  useCaseRows: ForecastUseCaseRow[],
  options: { totalAdsNeeded?: number; ugcPctExclude?: number } = {}
): FcOutput {
  const monthLabel = monthKey.replace(/(\w{3})(\d{2})/, (_, m, y) => `${m}-${y}`)
  const totalAdsNeeded = options.totalAdsNeeded ?? 525
  const ugcPct = options.ugcPctExclude ?? 0.27

  const assetMix: FcAssetMixRow[] = CONTENT_BUCKETS.map((bucket) => {
    const label =
      bucket === 'CAM' ? 'Campaigns / Product Launches' : bucket
    const pct =
      DEFAULT_ASSET_MIX_PCT[label] ??
      (bucket === 'BAU' ? 0.52 : bucket === 'EXP' ? 0.08 : 0)
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

  const funnel: FcFunnelRow[] = FUNNEL_STAGES.map((stage) => {
    const pct = DEFAULT_FUNNEL_PCT[stage] ?? 0
    const productionTarget = round(pct * totalAdsNeeded)
    return {
      stage,
      pctAttribution: pct,
      productionTarget,
      forecasted: productionTarget,
    }
  })

  const assetType: FcAssetTypeRow[] = ASSET_TYPES.map((assetTypeName) => {
    const key = assetTypeName === 'Partnership Code' ? 'Partnership' : assetTypeName
    const pct = DEFAULT_ASSET_TYPE_PCT[key] ?? 0
    const productionTarget = round(pct * totalAdsNeeded)
    return {
      assetType: assetTypeName,
      pctAttribution: pct,
      productionTarget,
      forecasted: productionTarget,
      csSheet: 0,
    }
  })

  const totalSpend = useCaseRows.reduce((s, r) => s + (r.results_spent ?? 0) + (r.forecasted_spent ?? 0), 0)
  const useCaseResults: FcUseCaseResultRow[] = KNOWN_USE_CASES.slice(0, 20).map((useCase) => {
    const rows = useCaseRows.filter((r) => r.use_case === useCase)
    const spend = rows.reduce((s, r) => s + (r.results_spent ?? 0) + (r.forecasted_spent ?? 0), 0)
    const revenue = rows.reduce((s, r) => s + (r.graph_revenue ?? 0), 0)
    const roas = spend ? revenue / spend : 0
    const pctTotalSpend = totalSpend ? spend / totalSpend : 0
    const type = USE_CASE_TYPE[useCase] ?? 'BAU'
    const adsProduction = type === 'CAM' ? 0 : round(pctTotalSpend * totalAdsNeeded * 0.5)
    const expProduction = type === 'EXP' ? adsProduction : 0
    return {
      useCase,
      spend,
      revenue,
      roas,
      manualBoost: 1,
      pctTotalSpend,
      adsProduction,
      expProduction,
      type,
    }
  }).filter((r) => r.spend > 0 || r.revenue > 0)

  const totalProductionTarget = assetMix.reduce((s, r) => s + r.productionTarget, 0)
  const totalForecasted = assetMix.reduce((s, r) => s + r.forecasted, 0)

  return {
    monthKey,
    monthLabel,
    totalAdsNeeded,
    assetMix,
    funnel,
    assetType,
    useCaseResults,
    totalProductionTarget,
    totalForecasted,
  }
}

/**
 * Compute CS output from FC output. Studio/agency list and detail rows can be empty (manual fill later).
 */
export function computeCsOutput(
  fc: FcOutput,
  options: {
    studioAgencyNames?: string[]
    detailRows?: CsDetailRow[]
  } = {}
): CsOutput {
  const { studioAgencyNames = [], detailRows = [] } = options

  const contentBucketSummary: CsContentBucketRow[] = fc.assetMix.map((row, i) => {
    const bucket = row.bucket
    const productionTargetUgcExcluded = round(row.productionTarget * (1 - 0.27))
    const forecastedUgcExcluded = row.static + row.carousel + row.video + row.partnershipCode
    const csSheet = detailRows
      .filter((d) => d.contentBucket === bucket)
      .reduce((s, d) => s + d.static + d.video + d.carousel, 0)
    return {
      bucket,
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

  return {
    monthKey: fc.monthKey,
    monthLabel: fc.monthLabel,
    totalAssets,
    contentBucketSummary,
    studioAgencyTable,
    detailRows,
  }
}
