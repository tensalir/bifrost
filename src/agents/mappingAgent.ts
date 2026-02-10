/**
 * Claude-powered Monday-to-Figma mapping agent.
 * Uses Bifrost Mapping Skill as system context; returns textMappings and frameRenames.
 * Falls back to column-only mapping when API key is missing or Claude fails.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import type { MondayItem } from '../integrations/monday/client.js'
import { columnMap, getCol } from '../integrations/monday/client.js'
import { mondayItemToBriefing } from '../domain/briefing/mondayToBriefing.js'
import type { BriefingDTO } from '../domain/briefing/schema.js'

const MAPPING_MODEL = 'claude-opus-4-6'

export interface TemplateNodeInfo {
  id: string
  name: string
  type: string
  children?: TemplateNodeInfo[]
}

export interface NodeMappingResult {
  textMappings: Array<{ nodeName: string; value: string }>
  frameRenames: Array<{ oldName: string; newName: string }>
}

const MappingOutputSchema = z.object({
  textMappings: z.array(z.object({ nodeName: z.string(), value: z.string() })),
  frameRenames: z.array(z.object({ oldName: z.string(), newName: z.string() })),
})

const VARIANT_LETTERS = ['A', 'B', 'C', 'D'] as const
const ASSET_SIZES = ['4x5', '9x16', '1x1'] as const

function getSkillPath(): string {
  const root = process.cwd()
  return join(root, 'skills', 'bifrost-mapping', 'SKILL.md')
}

function upsertMapping(
  mappings: Array<{ nodeName: string; value: string }>,
  nodeName: string,
  value: string | null | undefined
): void {
  if (!value || !value.trim()) return
  const idx = mappings.findIndex((m) => m.nodeName === nodeName)
  if (idx >= 0) {
    if (!mappings[idx].value || !mappings[idx].value.trim()) mappings[idx].value = value
    return
  }
  mappings.push({ nodeName, value })
}

function extractDocSection(doc: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rx = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\n\\s*[A-Z][A-Za-z ]*\\s*\\n|$)`, 'i')
  const match = rx.exec(doc)
  if (!match?.[1]) return null
  const text = match[1].trim()
  return text || null
}

interface VariantRow {
  id: 'A' | 'B' | 'C' | 'D'
  type?: string
  visual?: string
  copy?: string
}

function firstSentence(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const match = /^(.+?[.!?])(?:\s|$)/.exec(trimmed)
  return (match?.[1] ?? trimmed).trim()
}

function remainderAfterFirstSentence(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const match = /^.+?[.!?](?:\s+|$)([\s\S]+)$/.exec(trimmed)
  return match?.[1]?.trim() || undefined
}

function parseVariantTableRows(doc: string): VariantRow[] {
  const out: VariantRow[] = []
  const lines = doc.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Markdown table style: | A | static | visual... | copy... |
    const table = /^\|?\s*([A-D])\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|?\s*$/i.exec(line)
    if (table) {
      out.push({
        id: table[1].toUpperCase() as VariantRow['id'],
        type: table[2].trim() || undefined,
        visual: table[3].trim() || undefined,
        copy: table[4].trim() || undefined,
      })
      continue
    }

    // Compact row style: "A - Video", "B: static"
    const compact = /^([A-D])\s*[-:]\s*(.+)$/i.exec(line)
    if (compact) {
      out.push({
        id: compact[1].toUpperCase() as VariantRow['id'],
        type: compact[2].trim() || undefined,
      })
    }
  }
  return out
}

function deterministicBackfill(
  base: NodeMappingResult,
  mondayItem: MondayItem,
  mondayDocContent?: string | null
): NodeMappingResult {
  const out: NodeMappingResult = {
    textMappings: [...base.textMappings],
    frameRenames: [...base.frameRenames],
  }

  const col = columnMap(mondayItem)
  const region = getCol(col, 'region', 'audience_region', 'audience')
  const funnel = getCol(col, 'funnel', 'segment')

  upsertMapping(out.textMappings, 'Name EXP', mondayItem.name)
  if (funnel) upsertMapping(out.textMappings, 'SEGMENT: ALL', `SEGMENT: ${funnel}`)

  let usedDocAudience = false
  if (mondayDocContent?.trim()) {
    const idea = extractDocSection(mondayDocContent, 'Idea')
    const why = extractDocSection(mondayDocContent, 'Why')
    const audience = extractDocSection(mondayDocContent, 'Audience')
    const formats = extractDocSection(mondayDocContent, 'Formats')
    const variants = extractDocSection(mondayDocContent, 'Variants')
    const product = extractDocSection(mondayDocContent, 'Product')
    const visual = extractDocSection(mondayDocContent, 'Visual')
    const copyInfo = extractDocSection(mondayDocContent, 'Copy info')
    const test = extractDocSection(mondayDocContent, 'Test')
    const variantRows = parseVariantTableRows(mondayDocContent)

    upsertMapping(out.textMappings, 'IDEA:', idea ?? undefined)
    upsertMapping(out.textMappings, 'WHY:', why ?? undefined)
    if (audience) {
      // Prefer rich audience details from the doc over plain region dropdown values.
      upsertMapping(out.textMappings, 'AUDIENCE/REGION:', `AUDIENCE/REGION:\n${audience}`)
      usedDocAudience = true
    }
    upsertMapping(out.textMappings, 'FORMATS:', formats ?? undefined)
    upsertMapping(out.textMappings, 'Product:', product ?? undefined)
    // Visual and Copy info: content-only (no "Visual:" or "Copy info:" prefix); plugin writes to Specs placeholder.
    const visualContent = visual?.replace(/^visual\s*:\s*/i, '').trim() || undefined
    const copyInfoContent = copyInfo?.replace(/^copy\s+info\s*:\s*/i, '').trim() || undefined
    upsertMapping(out.textMappings, 'Visual', visualContent)
    upsertMapping(out.textMappings, 'Copy info:', copyInfoContent)
    upsertMapping(out.textMappings, 'Test:', test ?? undefined)

    if (variants) {
      const firstLine = variants.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? variants.trim()
      if (/^\d+$/.test(firstLine)) {
        upsertMapping(out.textMappings, 'VARIANTS: 4', `VARIANTS: ${firstLine}`)
      }
    }

    // Variant rows from Monday table -> Briefing column variant blocks only (multi-line type + Visual + Copy).
    // Do NOT map input data into Copy column Variation frames (those are for in-design copy only).
    for (const row of variantRows) {
      const typeLabel = row.type ? `${row.id} - ${row.type}` : `${row.id} - Image`
      const hasVisual = row.visual?.trim()
      const hasCopy = row.copy?.trim()
      const blockValue =
        hasVisual || hasCopy
          ? `${typeLabel}:\n${hasVisual ? `Visual: ${row.visual!.trim()}\n` : ''}${hasCopy ? `Copy: ${row.copy!.trim()}` : ''}`.trim()
          : typeLabel
      upsertMapping(out.textMappings, `${row.id} - Image`, blockValue)
      upsertMapping(out.textMappings, `${row.id} - Image `, blockValue)
    }
  }

  // Fallback when doc audience is missing.
  if (!usedDocAudience && region) {
    upsertMapping(out.textMappings, 'AUDIENCE/REGION:', `AUDIENCE/REGION: ${region}`)
  }

  return out
}

export function loadSkillContent(): string {
  try {
    return readFileSync(getSkillPath(), 'utf-8')
  } catch {
    return ''
  }
}

/**
 * Fallback: derive textMappings and frameRenames from BriefingDTO (column-only).
 */
export function briefingToNodeMapping(dto: BriefingDTO): NodeMappingResult {
  const textMappings: Array<{ nodeName: string; value: string }> = []
  const expName = dto.experimentName

  textMappings.push({ nodeName: 'Name EXP', value: expName })
  if (dto.idea) textMappings.push({ nodeName: 'IDEA:', value: dto.idea })
  if (dto.audienceRegion)
    textMappings.push({ nodeName: 'AUDIENCE/REGION:', value: `AUDIENCE/REGION: ${dto.audienceRegion}` })
  if (dto.segment) textMappings.push({ nodeName: 'SEGMENT: ALL', value: `SEGMENT: ${dto.segment}` })
  if (dto.formats) textMappings.push({ nodeName: 'FORMATS:', value: dto.formats })

  for (let i = 0; i < dto.variants.length; i++) {
    const v = dto.variants[i]
    const letter = VARIANT_LETTERS[i]
    if (v.headline) textMappings.push({ nodeName: 'headline:', value: v.headline })
    if (v.subline) textMappings.push({ nodeName: 'subline:', value: v.subline })
    if (v.cta) textMappings.push({ nodeName: 'CTA:', value: v.cta })
    if (v.note) textMappings.push({ nodeName: 'Note:', value: v.note })
  }

  const frameRenames: Array<{ oldName: string; newName: string }> = []
  for (const letter of VARIANT_LETTERS) {
    for (const size of ASSET_SIZES) {
      frameRenames.push({
        oldName: `NAME-EXP-${size}`,
        newName: `${expName}-${letter}-${size}`,
      })
    }
  }

  return { textMappings, frameRenames }
}

/**
 * Call Claude to compute node mapping from Monday item + template tree (+ optional doc).
 * Returns fallback mapping if API key missing or request fails.
 */
export async function computeNodeMapping(
  mondayItem: MondayItem,
  templateNodeTree: TemplateNodeInfo[],
  options?: { mondayDocContent?: string | null }
): Promise<NodeMappingResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey?.trim()) {
    const dto = mondayItemToBriefing(mondayItem)
    if (!dto) return { textMappings: [], frameRenames: [] }
    return deterministicBackfill(briefingToNodeMapping(dto), mondayItem, options?.mondayDocContent ?? null)
  }

  const skillContent = loadSkillContent()
  const userPayload = {
    mondayItem: {
      id: mondayItem.id,
      name: mondayItem.name,
      column_values: mondayItem.column_values ?? [],
    },
    templateNodeTree,
    mondayDocContent: options?.mondayDocContent ?? null,
  }
  const userMessage = `Map this Monday item and optional doc onto the template nodes.
Important:
- Fill variant rows A/B/C/D from Monday into the Briefing column variant blocks (A - Image, B - Image, etc.) as multi-line text: type line, then "Visual: ...", then "Copy: ...". Do NOT put this input data into the Copy column Variation frames — those are for final in-design copy only.
- Map Briefing variant type labels (A - Image -> A - Static, etc.) and put the full variant block content (type + input visual + input copy) into those same nodes.
- Only fill Copy column Variation frames (headline:/subline:/CTA:/Note:) when the Monday doc has explicit "in design copy" or script content for that variation.
Return only a single JSON object with keys "textMappings" and "frameRenames", no markdown or explanation.

${JSON.stringify(userPayload, null, 2)}`

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: MAPPING_MODEL,
      max_tokens: 4096,
      system: skillContent || 'You are a mapping agent. Return only valid JSON with textMappings and frameRenames.',
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const text = textBlock && 'text' in textBlock ? textBlock.text : null
    if (!text?.trim()) {
      return fallbackMapping(mondayItem)
    }

    const raw = text.trim()
    const json = raw.startsWith('```') ? raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '') : raw
    const parsed = JSON.parse(json) as unknown
    const result = MappingOutputSchema.safeParse(parsed)
    if (result.success) {
      return deterministicBackfill(result.data, mondayItem, options?.mondayDocContent ?? null)
    }
    return deterministicBackfill(fallbackMapping(mondayItem), mondayItem, options?.mondayDocContent ?? null)
  } catch {
    return deterministicBackfill(fallbackMapping(mondayItem), mondayItem, options?.mondayDocContent ?? null)
  }
}

function fallbackMapping(mondayItem: MondayItem): NodeMappingResult {
  const dto = mondayItemToBriefing(mondayItem)
  if (!dto) return { textMappings: [], frameRenames: [] }
  return briefingToNodeMapping(dto)
}
