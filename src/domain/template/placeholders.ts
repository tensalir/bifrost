/**
 * Canonical placeholder IDs for Figma template nodes.
 * Template designers must set plugin data "bifrostId" (or "placeholderId") on text nodes to these values.
 * Long text: use textAutoResize HEIGHT in plugin (grow). Overflow policy per section is configurable.
 */

export const PLACEHOLDER_IDS = [
  'bifrost:exp_name',
  'bifrost:idea',
  'bifrost:audience_region',
  'bifrost:segment',
  'bifrost:formats',
  'bifrost:var_a_headline',
  'bifrost:var_a_subline',
  'bifrost:var_a_cta',
  'bifrost:var_b_headline',
  'bifrost:var_b_subline',
  'bifrost:var_b_cta',
  'bifrost:var_c_headline',
  'bifrost:var_c_subline',
  'bifrost:var_c_cta',
  'bifrost:var_d_headline',
  'bifrost:var_d_subline',
  'bifrost:var_d_cta',
] as const

export type PlaceholderId = (typeof PLACEHOLDER_IDS)[number]

/** Overflow policy for long copy: grow node height, clamp with ellipsis, or move excess to notes block. */
export type OverflowPolicy = 'grow' | 'clamp' | 'notes'

/** Default: grow text node height to fit (textAutoResize = HEIGHT). */
export const DEFAULT_OVERFLOW_POLICY: OverflowPolicy = 'grow'

/** Placeholders that use grow by default (briefing/copy blocks). */
export const GROW_PLACEHOLDERS: PlaceholderId[] = [
  'bifrost:idea',
  'bifrost:var_a_headline',
  'bifrost:var_a_subline',
  'bifrost:var_a_cta',
  'bifrost:var_b_headline',
  'bifrost:var_b_subline',
  'bifrost:var_b_cta',
  'bifrost:var_c_headline',
  'bifrost:var_c_subline',
  'bifrost:var_c_cta',
  'bifrost:var_d_headline',
  'bifrost:var_d_subline',
  'bifrost:var_d_cta',
]
