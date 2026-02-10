/**
 * Canonical briefing DTO: Monday columns mapped to fields used for Figma template fill.
 * Lock to column IDs in production; display names are for UX only.
 */

export interface BriefingDTO {
  mondayItemId: string
  /** Experiment code + short title, e.g. EXP-LM177.ChooseYourLoop-Mix-Productfocus */
  experimentName: string
  /** Canonical month key from batch, e.g. 2026-03 */
  batchCanonical: string
  /** Raw batch value from Monday (e.g. MARCH 2026) */
  batchRaw: string | null
  /**
   * Section name for page ordering in Figma.
   * Maps to the empty divider page (e.g. "BUNDLES", "SWITCH", "ENGAGED KITS").
   * Sourced from Monday "use_case" / "product" column, or parsed from experiment name.
   */
  sectionName?: string
  idea?: string
  audienceRegion?: string
  segment?: string
  formats?: string
  /** Variant blocks A–D with copy fields */
  variants: VariantBlock[]
  /** Optional link for review / Figma URL once created */
  linkForReview?: string
}

export interface VariantBlock {
  id: 'A' | 'B' | 'C' | 'D'
  product?: string
  visualMessaging?: string
  headlines?: string
  description?: string
  cta?: string
  valueProp?: string
  /** In-design copy: headline, subline, bullets, CTA, note */
  headline?: string
  subline?: string
  bullets?: string
  note?: string
}

/** Canonical page name for a new experiment page in Figma. */
export function formatExperimentPageName(dto: BriefingDTO): string {
  return dto.experimentName
}
