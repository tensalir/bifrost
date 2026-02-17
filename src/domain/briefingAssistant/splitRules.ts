/**
 * Configurable split rules (Creative Strategy can adjust without code changes).
 * Values from Siobhan Q1 planning.
 */

import type { SplitRulesConfig } from './split.js'

/** Default rules: funnel 75/20/5, format 35/40/20/5, BAU min 70%, product tiers, agency capacity. */
export const defaultSplitRules: SplitRulesConfig = {
  funnel: { tof: 0.75, bof: 0.2, retention: 0.05 },
  format: {
    static: 0.35,
    video: 0.4,
    staticCarousel: 0.2,
    videoCarousel: 0.05,
  },
  bauMinShare: 0.7,
  productTiers: {
    high: {
      briefs: 3,
      assetsPerBrief: 16,
      products: ['quiet', 'dream'],
    },
    medium: {
      briefs: 2,
      assetsPerBrief: 16,
      products: ['switch', 'bundles'],
    },
    low: {
      briefs: 1,
      assetsPerBrief: 16,
      products: ['engage', 'engage_kids', 'experience', 'earplugs_collection'],
    },
  },
  agencyCapacity: {
    Studio: { experiments: 10, variantsPerExperiment: 4 },
    Gain: { experiments: 20, variantsPerExperiment: 4 },
    Statiq: { experiments: 10, variantsPerExperiment: 4 },
    Goodo: { experiments: 4, variantsPerExperiment: 4 },
  },
  variantsPerExperiment: 4,
}
