/**
 * Deterministic parser for Monday "batch" values into canonical monthly key
 * and expected Figma file name (MONTH YYYY - PerformanceAds).
 */

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
] as const

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export interface BatchParseResult {
  /** Canonical key for lookup: YYYY-MM */
  canonicalKey: string
  /** Display file name: MONTH YYYY - PerformanceAds */
  expectedFileName: string
  /** Year number */
  year: number
  /** Month 1–12 */
  month: number
}

/**
 * Parse batch string (e.g. "MARCH 2026", "Mar 2026", "2026-03") into canonical key and expected file name.
 * Returns null if unparseable.
 */
export function parseBatchToCanonical(batch: string | null | undefined): BatchParseResult | null {
  const raw = typeof batch === 'string' ? batch.trim() : ''
  if (!raw) return null

  // Already YYYY-MM or YYYY-M
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})$/)
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10)
    const m = parseInt(isoMatch[2], 10)
    if (m >= 1 && m <= 12) {
      const monthName = MONTH_NAMES[m - 1]
      return {
        canonicalKey: `${y}-${String(m).padStart(2, '0')}`,
        expectedFileName: `${monthName} ${y} - PerformanceAds`,
        year: y,
        month: m,
      }
    }
  }

  // "MARCH 2026" or "Mar 2026" or "March 2026"
  const parts = raw.split(/\s+/)
  if (parts.length >= 2) {
    const monthPart = parts[0].toUpperCase()
    const yearPart = parts[parts.length - 1]
    const y = parseInt(yearPart, 10)
    if (!Number.isNaN(y) && y >= 2000 && y <= 2100) {
      let monthIndex = MONTH_NAMES.findIndex((m) => m === monthPart || m.startsWith(monthPart))
      if (monthIndex === -1) {
        const abbrev = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
        monthIndex = MONTH_ABBREV.findIndex((m) => m === abbrev || monthPart.startsWith(m))
      }
      if (monthIndex >= 0) {
        const m = monthIndex + 1
        const monthName = MONTH_NAMES[monthIndex]
        return {
          canonicalKey: `${y}-${String(m).padStart(2, '0')}`,
          expectedFileName: `${monthName} ${y} - PerformanceAds`,
          year: y,
          month: m,
        }
      }
    }
  }

  // Try "March2026" or "2026March"
  const combined = raw.replace(/\s/g, '')
  const combinedMatch = combined.match(/^(\d{4})([A-Za-z]+)$/) || combined.match(/^([A-Za-z]+)(\d{4})$/)
  if (combinedMatch) {
    const numPart = combinedMatch[1]!
    const strPart = combinedMatch[2]!
    const y = parseInt(numPart, 10)
    if (!Number.isNaN(y) && y >= 2000 && y <= 2100) {
      const monthPart = strPart.toUpperCase()
      let monthIndex = MONTH_NAMES.findIndex((m) => m === monthPart || m.startsWith(monthPart))
      if (monthIndex >= 0) {
        const m = monthIndex + 1
        const monthName = MONTH_NAMES[monthIndex]
        return {
          canonicalKey: `${y}-${String(m).padStart(2, '0')}`,
          expectedFileName: `${monthName} ${y} - PerformanceAds`,
          year: y,
          month: m,
        }
      }
    }
  }

  return null
}

/**
 * Build expected Figma file name from canonical key (YYYY-MM).
 */
export function expectedFileNameFromCanonicalKey(canonicalKey: string): string {
  const [y, m] = canonicalKey.split('-').map(Number)
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return `${canonicalKey} - PerformanceAds`
  const monthName = MONTH_NAMES[m - 1]
  return `${monthName} ${y} - PerformanceAds`
}
