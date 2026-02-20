/**
 * Forecast workbook audit: FC/CS formula groups and parity control-cell set.
 * Used by the parity engine and validator to ensure code matches Excel behavior.
 */

/** Sheet name pattern: FC-May26, CS-May26, Use Case Data, OVERVIEW */
export const USE_CASE_DATA_SHEET = 'Use Case Data'
export const FC_SHEET_PREFIX = 'FC-'
export const CS_SHEET_PREFIX = 'CS-'

/** Use Case Data column indices (0-based from row 2 header). Row 1 = B1 "Use Case - Results". */
export const USE_CASE_COLUMNS = {
  year: 1,           // B
  month: 2,          // C
  useCase: 3,        // D
  graphSpent: 4,     // E (formula: IFERROR(IF(H<>0,H,IF(AND(H=0,J=0),0,J)),0))
  graphRevenue: 5,   // F (formula: IFERROR(IF(M<>0,M,...),0))
  roas: 6,           // G = F/E
  resultsSpent: 7,   // H (raw)
  spentPctTotal: 8,  // I = H/SUMIFS(H,H,D,D,B,B)
  forecastedSpent: 9, // J (VLOOKUP(CONCAT(D,B), $AY$31:$BF$58, 5)*I...)
  // M = forecasted revenue, O = forecasted variant, etc.
} as const

/** FC sheet formula groups (by region). Row numbers 1-based. */
export const FC_FORMULA_GROUPS = {
  /** A1 = month label (e.g. May-26), B3 = Total Ads Needed (number or formula), B5 = Adspend Target Global (VLOOKUP Use Case Data). */
  headerAndTotals: { rows: [1, 3, 5, 6, 7], cols: ['A', 'B'] },
  /** Asset Mix table: D2:H2 headers (Asset Mix, % Attribution, Production Target, Forecasted, Static, Carousel, Video, UGC). Rows 3-8: BAU, EXP, CAM, Localisation, Growth, TOTAL. */
  assetMix: { startRow: 2, endRow: 8, cols: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] },
  /** Funnel stage: D11:E15 TOF/BOF/RET, Production Target = ROUND(E*$B$3). */
  funnelStage: { startRow: 11, endRow: 15, cols: ['D', 'E', 'F', 'G'] },
  /** Asset type (Static/Carousel/Video/UGC/Partnership): N10:R16, Production Target = ROUND(O*$B$3). */
  assetType: { startRow: 10, endRow: 16, cols: ['N', 'O', 'P', 'Q', 'R'] },
  /** Use case results + forecast production: A21:I53. Use cases list, Spend (array), Revenue (array), ROAS, Manual BOOST, % Total Spend, Ads Production, EXP Production, Type. */
  useCaseResults: { startRow: 21, endRow: 53, cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] },
  /** Table data blocks that FC references (e.g. rows 59-350 for Asset_Mix_May, Channel_Mix_May). */
  tableDataBlocks: { assetMixStart: 59, assetMixEnd: 157, useCaseStart: 59, useCaseEnd: 350 },
} as const

/** CS sheet formula groups. */
export const CS_FORMULA_GROUPS = {
  /** B1 = CONCATENATE("TOTAL : ", SUM(C23:E1020)). Content Bucket summary A7:D13 (EXP, BAU, CAM, Localisation, Growth, TOTAL). */
  contentBucketSummary: { startRow: 7, endRow: 13, cols: ['A', 'B', 'C', 'D'] },
  /** Studio/Agency columns F2:L18 - Studio N, Studio L, 5pm, ... TOTAL. G = SUMIF(K23:K1020, F, M23:M1020). I:L = use-case allocation from FC. */
  studioAgencyTable: { startRow: 2, endRow: 18, cols: ['F', 'G', 'I', 'J', 'K', 'L'] },
  /** Detail rows 22+: Siobhan Ref, Content Bucket, Static, Video, Carousel, Ideation Starter, Experiment Name, Notes, Type/Use Case, Brief Owner, Studio/Agency, Agency Ref, No. of Assets. M23 = IFERROR(IF(A23="","",SUM(C23:E23)),0). */
  detailRows: { headerRow: 22, dataStartRow: 23, cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'] },
} as const

/** Parity control cells: one per critical output so validator can compare workbook vs engine. */
export interface ParityControlCell {
  sheet: string
  cell: string
  description: string
  /** Expected formula family for documentation. */
  formulaFamily?: string
}

/** Control cells for Use Case Data (sample row 3). */
export const USE_CASE_PARITY_CONTROLS: ParityControlCell[] = [
  { sheet: USE_CASE_DATA_SHEET, cell: 'E3', description: 'Graph Spent (real or forecast)', formulaFamily: 'IFERROR(IF(H<>0,H,...),0)' },
  { sheet: USE_CASE_DATA_SHEET, cell: 'G3', description: 'ROAS', formulaFamily: 'F/E' },
  { sheet: USE_CASE_DATA_SHEET, cell: 'I3', description: 'Spent % total per use case/year', formulaFamily: 'H/SUMIFS(H,D,D,B,B)' },
]

/** Control cells for FC (month-agnostic; month substituted at runtime). */
export function getFcParityControls(monthKey: string): ParityControlCell[] {
  const fcSheet = `${FC_SHEET_PREFIX}${monthKey}`
  return [
    { sheet: fcSheet, cell: 'B3', description: 'Total Ads Needed', formulaFamily: 'numeric_or_formula' },
    { sheet: fcSheet, cell: 'F3', description: 'BAU Production Target', formulaFamily: 'ROUND(E3*$B$3,0)' },
    { sheet: fcSheet, cell: 'E8', description: 'TOTAL % Attribution', formulaFamily: 'SUM(E3:E7)' },
    { sheet: fcSheet, cell: 'F8', description: 'TOTAL Production Target', formulaFamily: 'SUM(F3:F7)' },
    { sheet: fcSheet, cell: 'O11', description: 'Static % Attribution', formulaFamily: 'asset type' },
    { sheet: fcSheet, cell: 'P11', description: 'Static Production Target', formulaFamily: 'ROUND(O11*$B$3,0)' },
  ]
}

/** Control cells for CS (month-agnostic). */
export function getCsParityControls(monthKey: string): ParityControlCell[] {
  const csSheet = `${CS_SHEET_PREFIX}${monthKey}`
  return [
    { sheet: csSheet, cell: 'B8', description: 'EXP Production Target (UGC Excluded)', formulaFamily: "ROUND('FC-*'!$F$4-('FC-*'!$F$4*'FC-*'!$O$14),0)" },
    { sheet: csSheet, cell: 'B9', description: 'BAU Production Target (UGC Excluded)', formulaFamily: "ROUND('FC-*'!$F$3-...,0)" },
    { sheet: csSheet, cell: 'D8', description: 'EXP CS Sheet (sum of assignments)', formulaFamily: 'SUMIF(B23:B1020,A8,M23:M1020)' },
    { sheet: csSheet, cell: 'G3', description: 'Studio N # Assets', formulaFamily: 'SUMIF(K23:K1020,F3,M23:M1020)' },
  ]
}

/** All parity controls for a given month (FC + CS). Use Case Data is global. */
export function getAllParityControlsForMonth(monthKey: string): ParityControlCell[] {
  return [
    ...USE_CASE_PARITY_CONTROLS,
    ...getFcParityControls(monthKey),
    ...getCsParityControls(monthKey),
  ]
}

/** Known use case names from workbook (for normalization). */
export const KNOWN_USE_CASES = [
  'Bundles', 'Generic', 'Sleep', 'NoiseSensitive', 'Switch', 'Quiz', 'Festival', 'Focus',
  'Kids', 'Comparison', 'Parenting', 'Wellness', 'DamagedHearing', 'Fashion', 'Hobbies',
  'Reactive', 'SocialEvents', 'Sports', 'Travel&Commuting', 'Safety&Health@Work', 'BFCM',
] as const

/** Content bucket labels in FC/CS. */
export const CONTENT_BUCKETS = ['EXP', 'BAU', 'CAM', 'Localisation', 'Growth'] as const

/** Asset type labels. */
export const ASSET_TYPES = ['Static', 'Carousel', 'Video', 'UGC', 'Partnership Code'] as const

/** Funnel stage labels. */
export const FUNNEL_STAGES = ['TOF', 'BOF', 'RET'] as const
