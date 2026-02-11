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
  value: string | null | undefined,
  force?: boolean
): void {
  if (!value || !value.trim()) return
  const idx = mappings.findIndex((m) => m.nodeName === nodeName)
  if (idx >= 0) {
    // force: overwrite even if Claude already filled it (ensures verbatim doc content wins)
    if (force || !mappings[idx].value || !mappings[idx].value.trim()) mappings[idx].value = value
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
  visualDirection?: string
  script?: string
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

/** Match start of a variant table row: |  A - Video | or | B - Video | */
const ROW_START = /^\|\s*([A-D])\s*-\s*([^|]+)\|/i

/**
 * Parse the Variants markdown table with multi-line cells.
 * Table format: | Variant | input visual + copy directions | Script |
 * Rows start with | A - Video | and span multiple lines until the next row or empty row.
 */
function parseVariantTableRows(doc: string): VariantRow[] {
  const out: VariantRow[] = []
  // Find table body: after the | --- | --- | --- | separator
  const sepMatch = doc.match(/\|\s*---\s*\|\s*---\s*\|\s*---\s*\|/)
  if (!sepMatch || sepMatch.index === undefined) return out
  const tableStart = sepMatch.index + sepMatch[0].length
  const tableBody = doc.slice(tableStart)

  const lines = tableBody.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const rowStartMatch = ROW_START.exec(line)
    if (!rowStartMatch) {
      i++
      continue
    }
    const id = rowStartMatch[1].toUpperCase() as VariantRow['id']
    const typeCell = rowStartMatch[2].trim()
    const typeLabel = typeCell || undefined

    const rowLines: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i]
      if (ROW_START.test(next) || /^\|\s*\|\s*\|\s*\|?\s*$/.test(next)) break
      rowLines.push(next)
      i++
    }

    const rowText = rowLines.join('\n')
    const parts = rowText.split('|')
    if (parts.length >= 4) {
      const visualDirection = parts[2].trim() || undefined
      const script = parts[3].trim() || undefined
      out.push({ id, type: typeLabel, visualDirection, script })
    } else {
      out.push({ id, type: typeLabel })
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

    // Force-overwrite all doc-sourced fields so verbatim Monday content always wins
    // over Claude's potentially paraphrased version.
    upsertMapping(out.textMappings, 'IDEA:', idea ?? undefined, true)
    upsertMapping(out.textMappings, 'WHY:', why ?? undefined, true)
    if (audience) {
      upsertMapping(out.textMappings, 'AUDIENCE/REGION:', `AUDIENCE/REGION:\n${audience}`, true)
      usedDocAudience = true
    }
    upsertMapping(out.textMappings, 'FORMATS:', formats ?? undefined, true)
    upsertMapping(out.textMappings, 'Product:', product ?? undefined, true)
    const visualContent = visual?.replace(/^visual\s*:\s*/i, '').trim() || undefined
    const copyInfoContent = copyInfo?.replace(/^copy\s+info\s*:\s*/i, '').trim() || undefined
    upsertMapping(out.textMappings, 'Visual', visualContent, true)
    upsertMapping(out.textMappings, 'Copy info:', copyInfoContent, true)
    upsertMapping(out.textMappings, 'Test:', test ?? undefined, true)

    if (variants) {
      const firstLine = variants.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? variants.trim()
      if (/^\d+$/.test(firstLine)) {
        upsertMapping(out.textMappings, 'VARIANTS: 4', `VARIANTS: ${firstLine}`)
      }
    }

    // Variant rows from Monday table -> Briefing column variant blocks.
    // Use Monday column names as sub-headers: "Input visual + copy direction:" and "Script:".
    // Only force-overwrite when we actually parsed content (not type-only).
    for (const row of variantRows) {
      const typeLabel = row.type ? `${row.id} - ${row.type}` : `${row.id} - Image`
      const hasVisual = row.visualDirection?.trim()
      const hasScript = row.script?.trim()
      const blockValue =
        hasVisual || hasScript
          ? `${typeLabel}\n${hasVisual ? `Input visual + copy direction: ${row.visualDirection!.trim()}\n` : ''}${hasScript ? `Script: ${row.script!.trim()}` : ''}`.trim()
          : typeLabel
      const hasContent = !!hasVisual || !!hasScript
      upsertMapping(out.textMappings, `${row.id} - Image`, blockValue, hasContent)
      upsertMapping(out.textMappings, `${row.id} - Image `, blockValue, hasContent)
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

CRITICAL: Copy ALL text VERBATIM from the Monday doc. NEVER rewrite, paraphrase, summarize, or change any content. Every word must match the source exactly.

Variant block structure (use these exact sub-headers — they are the Monday column names):
- First line: variant type (e.g. "A - Video") from the Variant column.
- Then "Input visual + copy direction: " followed by the verbatim text from the "input visual + copy directions" column.
- Then "Script: " followed by the verbatim text from the Script column.

Rules:
- Fill variant rows A/B/C/D from Monday into the Briefing column variant blocks (A - Image, B - Image, etc.) using the structure above. Copy all text WORD FOR WORD.
- Map Briefing variant type labels (A - Image -> A - Static, etc.) and put the full variant block into those same nodes.
- Do NOT put this input data into the Copy column Variation frames — those are for final in-design copy only.
- Only fill Copy column Variation frames (headline:/subline:/CTA:/Note:) when the Monday doc has explicit "in design copy" for that variation.
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
