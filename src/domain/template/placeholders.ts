/**
 * Canonical placeholder IDs for Figma template nodes.
 * Template designers must set plugin data "heimdallId" (or "placeholderId") on text nodes to these values.
 * Long text: use textAutoResize HEIGHT in plugin (grow). Overflow policy per section is configurable.
 */

export const PLACEHOLDER_IDS = [
  'heimdall:exp_name',
  'heimdall:idea',
  'heimdall:audience_region',
  'heimdall:segment',
  'heimdall:formats',
  'heimdall:var_a_headline',
  'heimdall:var_a_subline',
  'heimdall:var_a_cta',
  'heimdall:var_b_headline',
  'heimdall:var_b_subline',
  'heimdall:var_b_cta',
  'heimdall:var_c_headline',
  'heimdall:var_c_subline',
  'heimdall:var_c_cta',
  'heimdall:var_d_headline',
  'heimdall:var_d_subline',
  'heimdall:var_d_cta',
] as const

export type PlaceholderId = (typeof PLACEHOLDER_IDS)[number]

/** Overflow policy for long copy: grow node height, clamp with ellipsis, or move excess to notes block. */
export type OverflowPolicy = 'grow' | 'clamp' | 'notes'

/** Default: grow text node height to fit (textAutoResize = HEIGHT). */
export const DEFAULT_OVERFLOW_POLICY: OverflowPolicy = 'grow'

/** Placeholders that use grow by default (briefing/copy blocks). */
export const GROW_PLACEHOLDERS: PlaceholderId[] = [
  'heimdall:idea',
  'heimdall:var_a_headline',
  'heimdall:var_a_subline',
  'heimdall:var_a_cta',
  'heimdall:var_b_headline',
  'heimdall:var_b_subline',
  'heimdall:var_b_cta',
  'heimdall:var_c_headline',
  'heimdall:var_c_subline',
  'heimdall:var_c_cta',
  'heimdall:var_d_headline',
  'heimdall:var_d_subline',
  'heimdall:var_d_cta',
]
