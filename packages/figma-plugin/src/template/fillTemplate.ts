/**
 * Fill template nodes from briefing payload.
 * Uses placeholder IDs (plugin data key "heimdallId") to find text nodes and set characters.
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
    case 'heimdall:exp_name':
      return briefing.experimentName ?? ''
    case 'heimdall:idea':
      return briefing.idea ?? ''
    case 'heimdall:audience_region':
      return briefing.audienceRegion ?? ''
    case 'heimdall:segment':
      return briefing.segment ?? ''
    case 'heimdall:formats':
      return briefing.formats ?? ''
    case 'heimdall:var_a_headline':
      return v[0]?.headline ?? ''
    case 'heimdall:var_a_subline':
      return v[0]?.subline ?? ''
    case 'heimdall:var_a_cta':
      return v[0]?.cta ?? ''
    case 'heimdall:var_b_headline':
      return v[1]?.headline ?? ''
    case 'heimdall:var_b_subline':
      return v[1]?.subline ?? ''
    case 'heimdall:var_b_cta':
      return v[1]?.cta ?? ''
    case 'heimdall:var_c_headline':
      return v[2]?.headline ?? ''
    case 'heimdall:var_c_subline':
      return v[2]?.subline ?? ''
    case 'heimdall:var_c_cta':
      return v[2]?.cta ?? ''
    case 'heimdall:var_d_headline':
      return v[3]?.headline ?? ''
    case 'heimdall:var_d_subline':
      return v[3]?.subline ?? ''
    case 'heimdall:var_d_cta':
      return v[3]?.cta ?? ''
    default:
      return ''
  }
}

/** Recursively find text nodes and fill by plugin data "heimdallId". */
export function fillTextNodes(
  node: SceneNode,
  briefing: BriefingPayload
): void {
  if (node.type === 'TEXT') {
    const heimdallId = (node as TextNode).getPluginData?.('heimdallId') ?? (node as TextNode).getPluginData?.('placeholderId')
    if (heimdallId) {
      const value = getPlaceholderValue(heimdallId, briefing)
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
