/**
 * Claude-powered Monday-to-Figma mapping agent.
 * Uses Heimdall Mapping Skill as system context; returns textMappings and frameRenames.
 * Falls back to column-only mapping when API key is missing or Claude fails.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { logger } from '../../lib/logger.js'
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
  return join(root, 'skills', 'heimdall-mapping', 'SKILL.md')
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

/** Canonical ALL CAPS labels for known Monday doc section headings (lowercase key). */
const HEADING_CANONICAL: Record<string, string> = {
  idea: 'IDEA',
  why: 'WHY',
  audience: 'AUDIENCE/REGION',
  'audience/region': 'AUDIENCE/REGION',
  formats: 'FORMATS',
  variants: 'VARIANTS',
  product: 'PRODUCT',
  visual: 'VISUAL',
  'copy info': 'COPY INFO',
  note: 'NOTE',
  test: 'TESTING',
  testing: 'TESTING',
}

/**
 * Extract all ## sections from doc in document order.
 * Unknown headings are included; use canonical map for known ones.
 */
function parseAllDocSections(doc: string): Array<{ heading: string; content: string }> {
  const sections: Array<{ heading: string; content: string }> = []
  // Match ## heading (line) then content until next ## or EOF
  const rx = /(?:^|\n)##\s*([^\n]+)\n([\s\S]*?)(?=\n##\s|\n*$)/gi
  let m: RegExpExecArray | null
  while ((m = rx.exec(doc)) !== null) {
    const heading = m[1].trim()
    const content = m[2].trim()
    if (heading) sections.push({ heading, content })
  }
  return sections
}

function getCanonicalLabel(heading: string): string {
  const key = heading.toLowerCase().trim()
  return HEADING_CANONICAL[key] ?? heading.toUpperCase()
}

/**
 * For FORMATS sections written as markdown checklists, keep only checked items
 * and strip checkbox markers so Figma shows clean plain text.
 */
function extractCheckedFormats(content: string): string {
  const lines = content.split(/\r?\n/)
  const checkedItems: string[] = []
  let sawChecklist = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const checked = /^[-*]\s*\[(?:x|X)\]\s*(.+)$/.exec(line)
    if (checked) {
      sawChecklist = true
      const value = checked[1].trim()
      if (value) checkedItems.push(`- ${value}`)
      continue
    }
    if (/^[-*]\s*\[\s*\]\s*(.+)$/.test(line)) {
      sawChecklist = true
    }
  }

  // If this section isn't checklist-based, preserve original content.
  if (!sawChecklist) return content.trim()
  return checkedItems.join('\n').trim()
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

/** Ensure a blank line precedes any line that starts with "Copy:" (variant block sub-label). */
function ensureBlankLineBeforeCopy(text: string): string {
  return text.replace(/\n(\s*Copy:)/gi, '\n\n$1')
}

function inferVariantCount(content: string, variantRows: VariantRow[]): number | null {
  const firstLine = content.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? ''
  if (/^\d+$/.test(firstLine)) return Number(firstLine)

  const rowCount = new Set(variantRows.map((r) => r.id)).size
  if (rowCount > 0) return rowCount

  const inlineLetters = new Set<string>()
  for (const line of content.split(/\r?\n/)) {
    const m = /^\s*[-*]?\s*([A-D])\s*-\s*/i.exec(line)
    if (m) inlineLetters.add(m[1].toUpperCase())
  }
  return inlineLetters.size > 0 ? inlineLetters.size : null
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
  // Find table body: after the separator row (2 or 3+ columns)
  const sepMatch = doc.match(/\|\s*---\s*\|\s*---\s*\|/)
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
    } else if (parts.length >= 3) {
      const visualDirection = parts[2].trim() || undefined
      out.push({ id, type: typeLabel, visualDirection })
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
    const sections = parseAllDocSections(mondayDocContent)
    const variantRows = parseVariantTableRows(mondayDocContent)

    // Build single "Briefing Content" body from all sections (canonical ALL CAPS labels).
    const parts: string[] = []
    for (const { heading, content } of sections) {
      if (!content.trim()) continue
      const label = getCanonicalLabel(heading)
      if (label === 'AUDIENCE/REGION') usedDocAudience = true
      // VARIANTS: keep count only in Briefing Content; detailed variant body lives in the dedicated variant blocks below.
      if (label === 'VARIANTS') {
        const variantCount = inferVariantCount(content, variantRows)
        if (variantCount && Number.isFinite(variantCount) && variantCount > 0) {
          parts.push(`VARIANTS: ${variantCount}`)
        }
        continue
      } else {
        const cleaned = content
          .replace(/^visual\s*:\s*/i, '')
          .replace(/^copy\s+info\s*:\s*/i, '')
          .trim()
        const sectionContent = label === 'FORMATS' ? extractCheckedFormats(cleaned) : cleaned
        if (sectionContent) parts.push(`${label}:\n${sectionContent}`)
      }
    }
    const briefingContent = parts.join('\n\n')
    if (briefingContent) upsertMapping(out.textMappings, 'Briefing Content', briefingContent, true)

    // Variant rows from Monday table -> Briefing column variant blocks (ALL CAPS type, blank line before Copy:).
    for (const row of variantRows) {
      const typeLabel = row.type
        ? `${row.id} - ${row.type.toUpperCase()}`
        : `${row.id} - IMAGE`
      const hasVisual = row.visualDirection?.trim()
      const hasScript = row.script?.trim()
      let blockValue =
        hasVisual || hasScript
          ? `${typeLabel}\n${hasVisual ? `Input visual + copy direction: ${row.visualDirection!.trim()}\n` : ''}${hasScript ? `Script: ${row.script!.trim()}` : ''}`.trim()
          : typeLabel
      blockValue = ensureBlankLineBeforeCopy(blockValue)
      const hasContent = !!hasVisual || !!hasScript
      upsertMapping(out.textMappings, `${row.id} - Image`, blockValue, hasContent)
      upsertMapping(out.textMappings, `${row.id} - Image `, blockValue, hasContent)
    }

    // Ensure VARIANTS header node always shows "VARIANTS", never the count.
    upsertMapping(out.textMappings, 'VARIANTS', 'VARIANTS', true)
  }

  // Fallback when doc audience is missing: add region into Briefing Content.
  if (!usedDocAudience && region) {
    const existing = out.textMappings.find((m) => m.nodeName === 'Briefing Content')
    const audienceLine = `AUDIENCE/REGION: ${region}`
    if (existing?.value) {
      existing.value = audienceLine + '\n\n' + existing.value
    } else {
      out.textMappings.push({ nodeName: 'Briefing Content', value: audienceLine })
    }
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

  // Single Briefing Content body for flexible template (column-only fallback).
  const bodyParts: string[] = []
  if (dto.idea) bodyParts.push(`IDEA:\n${dto.idea}`)
  if (dto.audienceRegion) bodyParts.push(`AUDIENCE/REGION: ${dto.audienceRegion}`)
  if (dto.segment) bodyParts.push(`SEGMENT: ${dto.segment}`)
  if (dto.formats) bodyParts.push(`FORMATS:\n${dto.formats}`)
  if (dto.variants.length) bodyParts.push(`VARIANTS: ${dto.variants.length}`)
  const briefingContent = bodyParts.join('\n\n')
  if (briefingContent) textMappings.push({ nodeName: 'Briefing Content', value: briefingContent })

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
  options?: { mondayDocContent?: string | null; disableAi?: boolean }
): Promise<NodeMappingResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (options?.disableAi || !apiKey?.trim()) {
    logger.info('mapping', 'Claude mapping disabled or key missing; using deterministic fallback', {
      mondayItemId: mondayItem.id,
      disableAi: options?.disableAi === true,
    })
    const dto = mondayItemToBriefing(mondayItem)
    if (!dto) return { textMappings: [], frameRenames: [] }
    return deterministicBackfill(briefingToNodeMapping(dto), mondayItem, options?.mondayDocContent ?? null)
  }

  const mappingTimer = logger.time('mapping', 'Claude mapping agent')

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
  const userMessage = `Map this Monday item and Monday briefing doc onto the Figma template nodes.

TASK: Extract ALL sections and content from the Monday doc (marked with ## headings, - bullets, [x] checklists) and map them to the corresponding Figma template text nodes. The doc uses markdown-like structure where:
- ## marks section headings (Idea, Why, Audience, Product, Visual, Copy info, etc.)
- - marks bullet list items
- [x] / [ ] mark checklist items
- Tables are formatted as | Variant | input visual | Script |

CRITICAL RULES:
1. Copy ALL text VERBATIM from the Monday doc. NEVER rewrite, paraphrase, summarize, or change any content. Every word must match the source exactly.
2. Extract COMPLETE sections including ALL nested bullets and sub-items. If a section has 5 bullet points, include all 5.
3. Reason through the doc structure step-by-step to ensure you capture every field.

Variant block structure (use these exact sub-headers — they are the Monday column names):
- First line: variant type (e.g. "A - Video") from the Variant column.
- Then "Input visual + copy direction: " followed by the verbatim text from the "input visual + copy directions" column.
- Then "Script: " followed by the verbatim text from the Script column.

Mapping rules:
- Include one "Briefing Content" entry in textMappings with the FULL pre-variant doc body: concatenate all sections from Idea through Test/Note into a single string with clear labels (e.g. "IDEA:\\n...\\n\\nWHY:\\n..."). This maps to the single Briefing Content text node in Figma.
- Fill variant rows A/B/C/D from Monday into the Briefing column variant blocks (A - Image, B - Image, etc.) using the structure above. Copy all text WORD FOR WORD.
- Map Briefing variant type labels (A - Image -> A - Static, etc.) and put the full variant block into those same nodes.
- Do NOT put this input data into the Copy column Variation frames — those are for final in-design copy only.
- Only fill Copy column Variation frames (headline:/subline:/CTA:/Note:) when the Monday doc has explicit "in design copy" for that variation.

OUTPUT: Return only a single JSON object with keys "textMappings" and "frameRenames", no markdown or explanation.

${JSON.stringify(userPayload, null, 2)}`

  try {
    const client = new Anthropic({ apiKey })
    const thinkingBudget = Number(process.env.ANTHROPIC_THINKING_BUDGET) || 10000
    const response = await client.messages.create({
      model: MAPPING_MODEL,
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: thinkingBudget,
      },
      system: skillContent || 'You are a mapping agent that reasons through Monday doc structure to extract all content. Return only valid JSON with textMappings and frameRenames.',
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
      const out = deterministicBackfill(result.data, mondayItem, options?.mondayDocContent ?? null)
      mappingTimer.done({
        mondayItemId: mondayItem.id,
        textMappingsCount: out.textMappings.length,
        frameRenamesCount: out.frameRenames.length,
      })
      return out
    }
    mappingTimer.done({ mondayItemId: mondayItem.id, fallback: 'schema_invalid' })
    logger.warn('mapping', 'Claude response schema invalid; using fallback', { mondayItemId: mondayItem.id })
    return deterministicBackfill(fallbackMapping(mondayItem), mondayItem, options?.mondayDocContent ?? null)
  } catch (err) {
    logger.error('mapping', 'Claude mapping agent failed', err as Error, { mondayItemId: mondayItem.id })
    return deterministicBackfill(fallbackMapping(mondayItem), mondayItem, options?.mondayDocContent ?? null)
  }
}

function fallbackMapping(mondayItem: MondayItem): NodeMappingResult {
  const dto = mondayItemToBriefing(mondayItem)
  if (!dto) return { textMappings: [], frameRenames: [] }
  return briefingToNodeMapping(dto)
}
