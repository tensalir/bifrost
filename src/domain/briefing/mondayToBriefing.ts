/**
 * Map Monday item (from API or webhook payload) to BriefingDTO.
 * Uses column IDs or normalized title keys (batch, idea, audience, variants, etc.).
 */

import type { MondayItem } from '../../integrations/monday/client.js'
import { columnMap, getCol } from '../../integrations/monday/client.js'
import { parseBatchToCanonical } from '../routing/batchToFile.js'
import type { BriefingDTO, VariantBlock } from './schema.js'

const VARIANT_IDS = ['A', 'B', 'C', 'D'] as const

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
  return {
    mondayItemId: item.id,
    experimentName: item.name,
    batchCanonical,
    batchRaw: batchRaw ?? null,
    idea: getCol(col, 'idea', 'idea_why') ?? undefined,
    audienceRegion: getCol(col, 'audience_region', 'audience', 'region') ?? undefined,
    segment: getCol(col, 'segment') ?? undefined,
    formats: getCol(col, 'formats', 'format') ?? undefined,
    variants,
    linkForReview: getCol(col, 'link_for_review', 'figma_link') ?? undefined,
  }
}
