import { createHash } from 'node:crypto'
import { z } from 'zod'

export const LOCALIZATION_CONTRACT_VERSION = '1.0.0'

const DuplicateDetectionMethodSchema = z.enum(['text', 'text_structure', 'vision'])
const ExclusionKindSchema = z.enum(['product_name', 'red_helper_text', 'manual', 'other'])
const ExclusionSourceSchema = z.enum(['auto', 'manual'])
const IngestionStatusSchema = z.enum(['accepted', 'processed', 'failed'])

export const ExclusionDecisionSchema = z.object({
  id: z.string().min(1),
  segmentId: z.string().min(1),
  kind: ExclusionKindSchema,
  source: ExclusionSourceSchema,
  confirmed: z.boolean(),
  reason: z.string().min(1),
})

export const LayerSegmentSchema = z.object({
  id: z.string().min(1),
  layerId: z.string().min(1),
  layerName: z.string().min(1),
  layerPath: z.array(z.string().min(1)),
  originalText: z.string(),
  normalizedText: z.string(),
  wordCount: z.number().int().min(0),
  isDuplicate: z.boolean(),
  duplicateGroupId: z.string().nullable(),
})

export const DuplicateGroupSchema = z.object({
  id: z.string().min(1),
  method: DuplicateDetectionMethodSchema,
  representativeSegmentId: z.string().min(1),
  segmentIds: z.array(z.string().min(1)).min(2),
  confidence: z.number().min(0).max(1),
})

export const WordCountTotalsSchema = z.object({
  rawWords: z.number().int().min(0),
  duplicateWords: z.number().int().min(0),
  excludedWords: z.number().int().min(0),
  translatableWords: z.number().int().min(0),
})

export const WordCountRunSchema = z.object({
  contractVersion: z.literal(LOCALIZATION_CONTRACT_VERSION),
  runId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  pluginVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  fileKey: z.string().min(1),
  pageId: z.string().min(1),
  pageName: z.string().min(1),
  segments: z.array(LayerSegmentSchema),
  duplicateGroups: z.array(DuplicateGroupSchema),
  exclusions: z.array(ExclusionDecisionSchema),
  totals: WordCountTotalsSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const IngestionAckSchema = z.object({
  contractVersion: z.literal(LOCALIZATION_CONTRACT_VERSION),
  runId: z.string().min(1),
  status: IngestionStatusSchema,
  receivedAt: z.string().datetime(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
})

export type IngestionAck = z.infer<typeof IngestionAckSchema>
export type WordCountRun = z.infer<typeof WordCountRunSchema>

export function buildWordCountIdempotencyKey(input: {
  fileKey: string
  pageId: string
  runFingerprint: string
  contractVersion?: string
}): string {
  const version = input.contractVersion ?? LOCALIZATION_CONTRACT_VERSION
  const raw = `${input.fileKey}:${input.pageId}:${input.runFingerprint}:${version}`
  return createHash('sha256').update(raw).digest('hex')
}

export function validateWordCountRun(payload: unknown): WordCountRun {
  return WordCountRunSchema.parse(payload)
}

export function validateIngestionAck(payload: unknown): IngestionAck {
  return IngestionAckSchema.parse(payload)
}
