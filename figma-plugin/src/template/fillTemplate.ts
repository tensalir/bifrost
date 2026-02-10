/**
 * Fill template nodes from briefing payload.
 * Uses placeholder IDs (plugin data key "bifrostId") to find text nodes and set characters.
 * Auto-resize: set text node textAutoResize to HEIGHT to grow with content.
 */

/** Briefing shape as received from backend (matches BriefingDTO). */
export interface BriefingPayload {
  experimentName?: string
  idea?: string
  audienceRegion?: string
  segment?: string
  formats?: string
  variants?: Array<{
    id?: string
    headline?: string
    subline?: string
    cta?: string
    product?: string
    valueProp?: string
  }>
}

/** Map placeholder ID to value from briefing. */
export function getPlaceholderValue(placeholderId: string, briefing: BriefingPayload): string {
  const v = briefing.variants ?? []
  switch (placeholderId) {
    case 'bifrost:exp_name':
      return briefing.experimentName ?? ''
    case 'bifrost:idea':
      return briefing.idea ?? ''
    case 'bifrost:audience_region':
      return briefing.audienceRegion ?? ''
    case 'bifrost:segment':
      return briefing.segment ?? ''
    case 'bifrost:formats':
      return briefing.formats ?? ''
    case 'bifrost:var_a_headline':
      return v[0]?.headline ?? ''
    case 'bifrost:var_a_subline':
      return v[0]?.subline ?? ''
    case 'bifrost:var_a_cta':
      return v[0]?.cta ?? ''
    case 'bifrost:var_b_headline':
      return v[1]?.headline ?? ''
    case 'bifrost:var_b_subline':
      return v[1]?.subline ?? ''
    case 'bifrost:var_b_cta':
      return v[1]?.cta ?? ''
    case 'bifrost:var_c_headline':
      return v[2]?.headline ?? ''
    case 'bifrost:var_c_subline':
      return v[2]?.subline ?? ''
    case 'bifrost:var_c_cta':
      return v[2]?.cta ?? ''
    case 'bifrost:var_d_headline':
      return v[3]?.headline ?? ''
    case 'bifrost:var_d_subline':
      return v[3]?.subline ?? ''
    case 'bifrost:var_d_cta':
      return v[3]?.cta ?? ''
    default:
      return ''
  }
}

/** Recursively find text nodes and fill by plugin data "bifrostId". */
export function fillTextNodes(
  node: SceneNode,
  briefing: BriefingPayload
): void {
  if (node.type === 'TEXT') {
    const bifrostId = (node as TextNode).getPluginData?.('bifrostId') ?? (node as TextNode).getPluginData?.('placeholderId')
    if (bifrostId) {
      const value = getPlaceholderValue(bifrostId, briefing)
      try {
        ;(node as TextNode).characters = value
        ;(node as TextNode).textAutoResize = 'HEIGHT'
      } catch (_) {
        // read-only or font missing
      }
    }
    return
  }
  if ('children' in node && node.children) {
    for (const child of node.children) {
      fillTextNodes(child, briefing)
    }
  }
}
