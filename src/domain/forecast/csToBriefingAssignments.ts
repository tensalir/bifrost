/**
 * Transform Forecast CS output (and detail rows) into BriefingAssignment payloads
 * for POST /api/briefing-assistant/sprints/[sprintId]/assignments.
 */

import type { BriefingAssignment } from '../briefingAssistant/schema.js'
import type { CsDetailRow, CsOutput } from './parityEngine.js'

const MONTH_KEY_TO_MM: Record<string, string> = {
  Jan26: '01', Feb26: '02', Mar26: '03', Apr26: '04', May26: '05', June26: '06',
  Jul26: '07', Aug26: '08', Sept26: '09', Sep26: '09', Oct26: '10', Nov26: '11', Dec26: '12',
}
const MONTH_KEY_TO_YEAR: Record<string, string> = {
  Jan26: '2026', Feb26: '2026', Mar26: '2026', Apr26: '2026', May26: '2026', June26: '2026',
  Jul26: '2026', Aug26: '2026', Sept26: '2026', Sep26: '2026', Oct26: '2026', Nov26: '2026', Dec26: '2026',
}

/** Map forecast monthKey (e.g. May26) to batch_key (e.g. 2026-05). */
export function monthKeyToBatchKey(monthKey: string): string {
  const mm = MONTH_KEY_TO_MM[monthKey] ?? '01'
  const yyyy = MONTH_KEY_TO_YEAR[monthKey] ?? '2026'
  return `${yyyy}-${mm}`
}

/** Map content bucket to briefing contentBucket. */
function bucketToContentBucket(bucket: string): 'bau' | 'native_style' | 'experimental' {
  const s = bucket.toLowerCase()
  if (s === 'exp') return 'experimental'
  if (s === 'cam') return 'native_style'
  return 'bau'
}

/** Map asset type (Static/Video/Carousel) to format. */
function assetTypeToFormat(asset: 'static' | 'video' | 'carousel'): string {
  if (asset === 'video') return 'video'
  if (asset === 'carousel') return 'static_carousel'
  return 'static'
}

/**
 * Build BriefingAssignment[] from CS detail rows. Each detail row can yield one or more
 * assignments (e.g. one per format if static+video+carousel are all > 0).
 */
export function csDetailRowsToAssignments(
  detailRows: CsDetailRow[],
  monthKey: string,
  batchLabel: string
): BriefingAssignment[] {
  const batchKey = monthKeyToBatchKey(monthKey)
  const assignments: BriefingAssignment[] = []
  let idx = 0
  for (const row of detailRows) {
    const total = row.static + row.video + row.carousel
    if (total <= 0) continue
    const contentBucket = bucketToContentBucket(row.contentBucket)
    const base = {
      contentBucket,
      ideationStarter: row.ideationStarter ?? '',
      productOrUseCase: row.typeUseCase || row.contentBucket || '—',
      briefOwner: row.briefOwner ?? '',
      agencyRef: row.studioAgency || row.agencyRef || '—',
      batchKey,
      briefName: row.experimentName || `${row.typeUseCase || row.contentBucket} ${idx + 1}`,
      source: 'imported' as const,
    }
    if (row.static > 0) {
      assignments.push({
        ...base,
        id: crypto.randomUUID(),
        assetCount: row.static,
        format: 'static',
        funnel: 'tof',
        briefName: row.experimentName || `${base.productOrUseCase} Static ${idx + 1}`,
      })
    }
    if (row.video > 0) {
      assignments.push({
        ...base,
        id: crypto.randomUUID(),
        assetCount: row.video,
        format: 'video',
        funnel: 'tof',
        briefName: row.experimentName || `${base.productOrUseCase} Video ${idx + 1}`,
      })
    }
    if (row.carousel > 0) {
      assignments.push({
        ...base,
        id: crypto.randomUUID(),
        assetCount: row.carousel,
        format: 'static_carousel',
        funnel: 'tof',
        briefName: row.experimentName || `${base.productOrUseCase} Carousel ${idx + 1}`,
      })
    }
    if (row.static === 0 && row.video === 0 && row.carousel === 0 && total > 0) {
      assignments.push({
        ...base,
        id: crypto.randomUUID(),
        assetCount: total,
        format: 'static',
        funnel: 'tof',
      })
    }
    idx++
  }
  return assignments
}

/**
 * Build a minimal set of BriefingAssignment rows from CS output when detail rows are empty
 * (e.g. one row per content bucket with asset count from production target).
 */
export function csOutputToMinimalAssignments(
  cs: CsOutput,
  batchLabel: string
): BriefingAssignment[] {
  const batchKey = monthKeyToBatchKey(cs.monthKey)
  const assignments: BriefingAssignment[] = []
  for (const row of cs.contentBucketSummary) {
    const n = row.productionTargetUgcExcluded || row.forecastedUgcExcluded || 0
    if (n <= 0) continue
    assignments.push({
      id: crypto.randomUUID(),
      contentBucket: bucketToContentBucket(row.bucket),
      ideationStarter: '',
      productOrUseCase: row.bucket,
      briefOwner: '',
      agencyRef: '—',
      assetCount: Math.max(1, Math.round(n / 4)),
      format: 'static',
      funnel: 'tof',
      batchKey,
      briefName: `${row.bucket} (from forecast)`,
      source: 'imported',
    })
  }
  return assignments
}
