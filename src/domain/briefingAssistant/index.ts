/**
 * Briefing Assistant domain: schema, split, angle context.
 */

export type {
  ApprovalStatus,
  WorkingDocSections,
  BriefingAssignment,
  GeneratedAngle,
  WorkingDocState,
  WorkingDocSectionsInput,
} from './schema.js'
export {
  workingDocToBriefingDTO,
  ApprovalStatusSchema,
  WorkingDocSectionsSchema,
  BriefingAssignmentSchema,
  GeneratedAngleSchema,
  WorkingDocStateSchema,
} from './schema.js'

export type {
  SplitInput,
  SplitAllocation,
  SplitOutput,
  SplitRulesConfig,
} from './split.js'
export { SplitInputSchema, SplitOutputSchema } from './split.js'

export type {
  EvidenceSnippet,
  AngleGenerationInput,
  AngleGenerationResult,
} from './angleContext.js'
export { EvidenceSnippetSchema, AngleGenerationInputSchema } from './angleContext.js'

export {
  getEvidence,
  SOURCE_IDS,
  metaAdapter,
  customerInsightsAdapter,
  socialCommentsAdapter,
  staticAdapter,
} from './sources/index.js'
export type { EvidenceSourceAdapter, EvidenceFilter } from './sources/types.js'
