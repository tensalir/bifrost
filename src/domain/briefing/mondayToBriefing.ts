/**
 * Map Monday item (from API or webhook payload) to BriefingDTO.
 * Uses column IDs or normalized title keys (batch, idea, audience, variants, etc.).
 */

import type { MondayItem } from '../../integrations/monday/client.js'
import { columnMap, getCol } from '../../integrations/monday/client.js'
import { parseBatchToCanonical } from '../routing/batchToFile.js'
import type { BriefingDTO, VariantBlock } from './schema.js'

const VARIANT_IDS = ['A', 'B', 'C', 'D'] as const

/**
 * Known section names that map to Figma divider pages.
 * These are the empty pages used as headers in monthly design files.
 * Add new ones here as the product portfolio grows.
 */
const KNOWN_SECTIONS = [
  'BUNDLES',
  'SWITCH',
  'ENGAGED KITS',
  'NOISE CANCELLING',
  'NOISE SENSITIVITY',
] as const

/**
 * Extract section name from Monday columns or fall back to parsing from experiment name.
 * Monday columns tried: use_case, product, product_category, section.
 * Name parsing: looks for known section keywords in the experiment name segments.
 */
function extractSectionName(
  col: Record<string, string | number | null>,
  experimentName: string
): string | undefined {
  // 1. Try explicit Monday column
  const explicit = getCol(col, 'use_case', 'product', 'product_category', 'section', 'category')
  if (explicit) {
    // Normalize to match Figma section divider names (uppercase)
    return explicit.toUpperCase().trim()
  }

  // 2. Fall back: parse from experiment name
  // Name pattern: EXP-LM168.FruitLoops-EngageKids-Mix or EXP-SB150.Q&ABundles-Bundles-Mix
  // Split on dots and dashes, check segments against known sections
  const segments = experimentName
    .replace(/^EXP-[A-Z0-9]+\./i, '') // strip "EXP-LM168."
    .split(/[-.]/)
    .map((s) => s.toUpperCase().trim())
    .filter(Boolean)

  for (const section of KNOWN_SECTIONS) {
    const sectionWords = section.split(/\s+/)
    // Match if any segment contains the section keyword (e.g. "BUNDLES" in "Q&ABUNDLES")
    if (segments.some((seg) => sectionWords.some((w) => seg.includes(w)))) {
      return section
    }
  }

  return undefined
}

function parseVariants(col: Record<string, string | number | null>): VariantBlock[] {
  const blocks: VariantBlock[] = []
  for (const id of VARIANT_IDS) {
    const lower = id.toLowerCase()
    const headline = getCol(col, `variant_${lower}_headline`, `var ${id} headline`, `headline_${lower}`)
    const subline = getCol(col, `variant_${lower}_subline`, `var ${id} subline`, `subline_${lower}`)
    const cta = getCol(col, `variant_${lower}_cta`, `var ${id} cta`, `cta_${lower}`, 'cta')
    const product = getCol(col, `variant_${lower}_product`, `product_${lower}`, 'product')
    const valueProp = getCol(col, `variant_${lower}_value_prop`, `value_prop_${lower}`)
    blocks.push({
      id: id as 'A' | 'B' | 'C' | 'D',
      headline: headline ?? undefined,
      subline: subline ?? undefined,
      cta: cta ?? undefined,
      product: product ?? undefined,
      valueProp: valueProp ?? undefined,
    })
  }
  return blocks
}

/**
 * Map Monday item to BriefingDTO. Requires batch and item name.
 */
export function mondayItemToBriefing(item: MondayItem): BriefingDTO | null {
  const col = columnMap(item)
  const batchRaw = getCol(col, 'batch', 'batch_name')
  const batchParse = batchRaw ? parseBatchToCanonical(batchRaw) : null
  const batchCanonical = batchParse?.canonicalKey ?? ''

  if (!batchCanonical) return null

  const variants = parseVariants(col)
  const sectionName = extractSectionName(col, item.name)
  return {
    mondayItemId: item.id,
    experimentName: item.name,
    batchCanonical,
    batchRaw: batchRaw ?? null,
    sectionName,
    idea: getCol(col, 'idea', 'idea_why') ?? undefined,
    audienceRegion: getCol(col, 'audience_region', 'audience', 'region') ?? undefined,
    segment: getCol(col, 'segment') ?? undefined,
    formats: getCol(col, 'formats', 'format') ?? undefined,
    variants,
    linkForReview: getCol(col, 'link_for_review', 'figma_link') ?? undefined,
  }
}
