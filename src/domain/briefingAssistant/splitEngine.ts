/**
 * Deterministic briefing split engine: revenue target → monthly asset count and assignments.
 */

import type { BriefingAssignment } from './schema.js'
import type { SplitInput, SplitOutput, SplitAllocation, SplitRulesConfig } from './split.js'
import { defaultSplitRules } from './splitRules.js'

const FORMATS = ['static', 'video', 'static_carousel', 'video_carousel'] as const
const FUNNELS = ['tof', 'bof', 'retention'] as const
const BUCKETS = ['bau', 'native_style', 'experimental'] as const

/** Run the split: produce assignments and allocation summary. */
export function runSplit(input: SplitInput, rules: SplitRulesConfig = defaultSplitRules): SplitOutput {
  const totalAssets = input.totalAssets
  const targetBriefs = input.maxBriefs ?? Math.ceil(totalAssets / rules.variantsPerExperiment)
  const briefCount = Math.min(targetBriefs, Math.ceil(totalAssets / 1)) // at least 1 asset per brief

  const byFunnel = {
    tof: Math.round(totalAssets * rules.funnel.tof),
    bof: Math.round(totalAssets * rules.funnel.bof),
    retention: Math.round(totalAssets * rules.funnel.retention),
  }
  // Normalize to total
  const funnelTotal = byFunnel.tof + byFunnel.bof + byFunnel.retention
  if (funnelTotal !== totalAssets) byFunnel.tof += totalAssets - funnelTotal

  const byFormat = {
    static: Math.round(totalAssets * rules.format.static),
    video: Math.round(totalAssets * rules.format.video),
    staticCarousel: Math.round(totalAssets * rules.format.staticCarousel),
    videoCarousel: Math.round(totalAssets * rules.format.videoCarousel),
  }
  let formatTotal = byFormat.static + byFormat.video + byFormat.staticCarousel + byFormat.videoCarousel
  if (formatTotal !== totalAssets) byFormat.static += totalAssets - formatTotal

  const bauCount = Math.round(totalAssets * rules.bauMinShare)
  const byBucket = { bau: bauCount, nativeStyleExperimental: totalAssets - bauCount }

  const agencyNames = Object.keys(rules.agencyCapacity)
  const byAgency: Record<string, number> = {}
  for (const name of agencyNames) {
    const cap = rules.agencyCapacity[name]
    byAgency[name] = cap.experiments * cap.variantsPerExperiment
  }

  const assignments = buildAssignments(
    input.batchKey,
    input.batchLabel,
    briefCount,
    totalAssets,
    rules
  )

  return {
    batchKey: input.batchKey,
    batchLabel: input.batchLabel,
    assignments,
    allocation: {
      byFunnel,
      byFormat,
      byBucket,
      byAgency,
      briefCount: assignments.length,
      totalAssets: assignments.reduce((s, a) => s + a.assetCount, 0),
    },
  }
}

function buildAssignments(
  batchKey: string,
  batchLabel: string,
  briefCount: number,
  totalAssets: number,
  rules: SplitRulesConfig
): BriefingAssignment[] {
  const list: BriefingAssignment[] = []
  const variants = rules.variantsPerExperiment
  const agencyNames = Object.keys(rules.agencyCapacity)
  const products: { product: string }[] = []
  for (const tier of ['high', 'medium', 'low'] as const) {
    const t = rules.productTiers[tier]
    for (const p of t.products) {
      for (let i = 0; i < t.briefs; i++) products.push({ product: p })
    }
  }
  const bauTarget = Math.round(briefCount * rules.bauMinShare)
  let assetSum = 0
  for (let i = 0; i < briefCount; i++) {
    const product = products[i % products.length]
    const agency = agencyNames[i % agencyNames.length]
    const format = FORMATS[i % FORMATS.length]
    const funnel = FUNNELS[i % FUNNELS.length]
    const isBau = i < bauTarget
    const contentBucket = isBau ? 'bau' : (i % 2 === 0 ? 'native_style' : 'experimental')
    const remainingBriefs = briefCount - (i + 1)
    const remainingAssets = totalAssets - assetSum
    const count =
      remainingBriefs === 0
        ? remainingAssets
        : Math.min(variants, Math.max(1, remainingAssets - remainingBriefs * 1))
    const assetCount = Math.max(1, Math.min(count, remainingAssets))
    assetSum += assetCount
    list.push({
      id: `ba-${batchKey}-${i + 1}`,
      contentBucket,
      ideationStarter: '',
      productOrUseCase: product.product,
      briefOwner: '',
      agencyRef: agency,
      assetCount: assetCount,
      format,
      funnel,
      batchKey,
      briefName: `${batchLabel} brief ${i + 1}`,
    })
  }
  const currentTotal = list.reduce((s, a) => s + a.assetCount, 0)
  if (list.length > 0 && currentTotal !== totalAssets) {
    const last = list[list.length - 1]
    last.assetCount = Math.max(1, last.assetCount + (totalAssets - currentTotal))
  }
  return list
}
