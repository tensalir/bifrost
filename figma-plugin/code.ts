/**
 * Bifrost Figma plugin - main thread (code.js).
 * Figma sandbox cannot fetch localhost; all HTTP goes through UI iframe.
 * Main thread handles: Figma API (clone page, fill text, reorder).
 * UI handles: fetch from Bifrost backend, user interaction.
 */

const TEMPLATE_PAGE_NAMES = ['Briefing Template to Duplicate', 'Briefing Template', 'Template']

interface QueuedJob {
  id: string
  idempotencyKey: string
  experimentPageName: string
  briefingPayload: BriefingPayload
  mondayItemId?: string
  /** Pre-computed node name → value; applied by node.name when present */
  nodeMapping?: Array<{ nodeName: string; value: string }>
  /** Pre-computed frame renames */
  frameRenames?: Array<{ oldName: string; newName: string }>
}

interface BriefingPayload {
  experimentName?: string
  sectionName?: string
  idea?: string
  audienceRegion?: string
  segment?: string
  formats?: string
  variants?: Array<{ headline?: string; subline?: string; cta?: string }>
}

function getPlaceholderValue(placeholderId: string, briefing: BriefingPayload): string {
  var v = briefing.variants || []
  var map: Record<string, string> = {
    'bifrost:exp_name': briefing.experimentName || '',
    'bifrost:idea': briefing.idea || '',
    'bifrost:audience_region': briefing.audienceRegion || '',
    'bifrost:segment': briefing.segment || '',
    'bifrost:formats': briefing.formats || '',
    'bifrost:var_a_headline': v[0] ? (v[0].headline || '') : '',
    'bifrost:var_a_subline': v[0] ? (v[0].subline || '') : '',
    'bifrost:var_a_cta': v[0] ? (v[0].cta || '') : '',
    'bifrost:var_b_headline': v[1] ? (v[1].headline || '') : '',
    'bifrost:var_b_subline': v[1] ? (v[1].subline || '') : '',
    'bifrost:var_b_cta': v[1] ? (v[1].cta || '') : '',
    'bifrost:var_c_headline': v[2] ? (v[2].headline || '') : '',
    'bifrost:var_c_subline': v[2] ? (v[2].subline || '') : '',
    'bifrost:var_c_cta': v[2] ? (v[2].cta || '') : '',
    'bifrost:var_d_headline': v[3] ? (v[3].headline || '') : '',
    'bifrost:var_d_subline': v[3] ? (v[3].subline || '') : '',
    'bifrost:var_d_cta': v[3] ? (v[3].cta || '') : '',
  }
  return map[placeholderId] || ''
}

async function loadFontsForTextNode(textNode: TextNode): Promise<void> {
  var len = textNode.characters.length
  if (len === 0) {
    // Empty node: load the single font
    var font = textNode.fontName as FontName
    if (font && font.family) {
      await figma.loadFontAsync(font)
    }
    return
  }
  // Load all fonts used across the text range (mixed fonts possible)
  var loaded = new Set<string>()
  for (var c = 0; c < len; c++) {
    var f = textNode.getRangeFontName(c, c + 1) as FontName
    if (f && f.family) {
      var key = f.family + ':' + f.style
      if (!loaded.has(key)) {
        loaded.add(key)
        await figma.loadFontAsync(f)
      }
    }
  }
}

async function fillTextNodes(node: BaseNode, briefing: BriefingPayload): Promise<void> {
  if (node.type === 'TEXT') {
    var textNode = node as TextNode
    var bifrostId = ''
    try { bifrostId = textNode.getPluginData('bifrostId') || textNode.getPluginData('placeholderId') } catch (_) {}
    if (bifrostId) {
      var value = getPlaceholderValue(bifrostId, briefing)
      // Do not overwrite existing mapped content with empty fallback values.
      if (!value || !value.trim()) return
      try {
        await loadFontsForTextNode(textNode)
        textNode.characters = value
        if (
          textNode.textAutoResize === 'HEIGHT' ||
          textNode.textAutoResize === 'WIDTH_AND_HEIGHT'
        ) {
          textNode.textAutoResize = 'HEIGHT'
        }
      } catch (_) {}
    }
    return
  }
  var withChildren = node as { children?: readonly BaseNode[] }
  if (withChildren.children && withChildren.children.length) {
    for (var i = 0; i < withChildren.children.length; i++) {
      await fillTextNodes(withChildren.children[i], briefing)
    }
  }
}

function normalizeTextKey(input: string): string {
  return input.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Label-as-pointer keys: content goes in sibling Specs > TEXT "-", not in the label node. */
const LABEL_POINTER_KEYS = new Set<string>(['visual', 'copy info:'])

/**
 * Find the sibling Specs frame's TEXT placeholder (the "-" node) for a label node.
 * Structure: parent (e.g. Elements) has label TEXT + FRAME "Specs" with child TEXT "-".
 */
function findSpecsPlaceholder(labelNode: TextNode): TextNode | null {
  const parent = labelNode.parent
  if (!parent || !('children' in parent) || !parent.children) return null
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (child.type !== 'FRAME') continue
    if (child.name !== 'Specs') continue
    const specChildren = (child as FrameNode).children || []
    for (let j = 0; j < specChildren.length; j++) {
      const c = specChildren[j]
      if (c.type === 'TEXT') return c as TextNode
    }
    return null
  }
  return null
}

/** Strip "Visual:" or "Copy info:" prefix from value for label-pointer fields. */
function stripLabelPointerPrefix(value: string, normalizedKey: string): string {
  if (LABEL_POINTER_KEYS.has(normalizedKey)) {
    return value
      .replace(/^visual\s*:\s*/i, '')
      .replace(/^copy\s+info\s*:\s*/i, '')
      .trim()
  }
  return value
}

interface MappingEntry {
  nodeName: string
  normalizedNodeName: string
  value: string
  used?: boolean
}

function cleanVariantValue(value: string, label: 'headline' | 'subline' | 'cta' | 'note'): string {
  const rx = new RegExp(`^\\s*${label}\\s*:\\s*`, 'i')
  return value.replace(rx, '').trim()
}

function getAncestorPath(node: BaseNode): string[] {
  const names: string[] = []
  let current: BaseNode | null = node
  while (current && 'parent' in current) {
    const p = current.parent
    if (!p || p.type === 'DOCUMENT') break
    if ('name' in p && typeof p.name === 'string' && p.name.trim()) {
      names.push(p.name.trim())
    }
    current = p as BaseNode
  }
  return names.reverse()
}

function buildTextCandidates(textNode: TextNode): string[] {
  const candidates = new Set<string>()
  const name = textNode.name || ''
  const chars = textNode.characters || ''
  if (name) candidates.add(name)
  if (chars) candidates.add(chars)

  const path = getAncestorPath(textNode)
  if (path.length > 0) {
    const parent = path[path.length - 1]
    if (name) candidates.add(`${parent}::${name}`)
    if (chars) candidates.add(`${parent}::${chars}`)
    const full = path.join(' > ')
    if (name) candidates.add(`${full}::${name}`)
    if (chars) candidates.add(`${full}::${chars}`)

    // Add partial ancestry forms so keys like "Variation A::headline:"
    // still match when there are intermediate wrapper groups.
    for (let i = 0; i < path.length; i++) {
      const partial = path.slice(0, i + 1).join(' > ')
      if (name) candidates.add(`${partial}::${name}`)
      if (chars) candidates.add(`${partial}::${chars}`)
    }
  }

  return Array.from(candidates)
}

function detectVariationLetter(textNode: TextNode): 'A' | 'B' | 'C' | 'D' | null {
  const path = getAncestorPath(textNode)
  for (let i = path.length - 1; i >= 0; i--) {
    const m = /variation\s*([A-D])/i.exec(path[i])
    if (m) return m[1].toUpperCase() as 'A' | 'B' | 'C' | 'D'
  }
  return null
}

function consumeScopedMapping(
  mappingEntries: MappingEntry[],
  variation: 'A' | 'B' | 'C' | 'D',
  suffix: 'headline:' | 'subline:' | 'cta:' | 'note:'
): string | undefined {
  const preferredSuffixes = [
    normalizeTextKey(`copy > variation ${variation}::${suffix}`),
    normalizeTextKey(`variation ${variation}::${suffix}`),
  ]
  for (const target of preferredSuffixes) {
    for (let i = 0; i < mappingEntries.length; i++) {
      const entry = mappingEntries[i]
      if (entry.used) continue
      if (entry.normalizedNodeName !== target) continue
      entry.used = true
      return entry.value
    }
  }
  return undefined
}

function patchInlineLabelValue(text: string, label: string, value: string | undefined): string {
  if (!value) return text
  const lines = text.split('\n')
  let changed = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (new RegExp(`^\\s*${label}\\s*:`, 'i').test(line)) {
      lines[i] = `${label}: ${value}`
      changed = true
      break
    }
  }
  return changed ? lines.join('\n') : text
}

function tryComposeVariationInline(textNode: TextNode, mappingEntries: MappingEntry[]): string | undefined {
  const variation = detectVariationLetter(textNode)
  if (!variation) return undefined

  let next = textNode.characters
  const norm = normalizeTextKey(next)

  const h = consumeScopedMapping(mappingEntries, variation, 'headline:')
  const s = consumeScopedMapping(mappingEntries, variation, 'subline:')
  const c = consumeScopedMapping(mappingEntries, variation, 'cta:')
  const n = consumeScopedMapping(mappingEntries, variation, 'note:')

  // Multi-label text block (headline/subline/CTA in one node)
  if (norm.includes('headline:') && norm.includes('subline:') && norm.includes('cta:')) {
    next = patchInlineLabelValue(next, 'headline', h ? cleanVariantValue(h, 'headline') : undefined)
    next = patchInlineLabelValue(next, 'subline', s ? cleanVariantValue(s, 'subline') : undefined)
    next = patchInlineLabelValue(next, 'CTA', c ? cleanVariantValue(c, 'cta') : undefined)
  }

  // Dedicated note line/block
  if (norm.includes('note:')) {
    next = patchInlineLabelValue(next, 'Note', n ? cleanVariantValue(n, 'note') : undefined)
  }

  return next !== textNode.characters ? next : undefined
}

function pickMappedValue(
  textNode: TextNode,
  mappingEntries: MappingEntry[]
): string | undefined {
  const path = getAncestorPath(textNode)
  const candidates = buildTextCandidates(textNode).map(normalizeTextKey)
  for (const candidate of candidates) {
    for (let i = 0; i < mappingEntries.length; i++) {
      const entry = mappingEntries[i]
      if (entry.used) continue
      if (entry.normalizedNodeName !== candidate) continue
      entry.used = true
      return entry.value
    }
  }

  // Fallback for duplicate label fields in Copy variation cards:
  // consume Variation A/B/C/D scoped mappings in traversal order.
  const inCopyOrVariation = path.some((p) => {
    const n = normalizeTextKey(p)
    return n.includes('copy') || n.includes('variation')
  })
  if (inCopyOrVariation) {
    const nameOrChars = [normalizeTextKey(textNode.name || ''), normalizeTextKey(textNode.characters || '')]
    const consumeBySuffix = (suffix: string): string | undefined => {
      for (let i = 0; i < mappingEntries.length; i++) {
        const entry = mappingEntries[i]
        if (entry.used) continue
        if (!entry.normalizedNodeName.endsWith(suffix)) continue
        entry.used = true
        return entry.value
      }
      return undefined
    }
    if (nameOrChars.includes('headline:')) return consumeBySuffix('::headline:')
    if (nameOrChars.includes('subline:')) return consumeBySuffix('::subline:')
    if (nameOrChars.includes('cta:')) return consumeBySuffix('::cta:')
    if (nameOrChars.includes('note:')) return consumeBySuffix('::note:')
  }

  return undefined
}

async function applyNodeMapping(
  node: BaseNode,
  mappingEntries: MappingEntry[],
  frameRenames: Array<{ oldName: string; newName: string }>
): Promise<void> {
  if (node.type === 'TEXT') {
    var textNode = node as TextNode
    var path = getAncestorPath(textNode)
    var value = pickMappedValue(textNode, mappingEntries)
    if (value === undefined) {
      value = tryComposeVariationInline(textNode, mappingEntries)
    }
    debugLog.push({
      nodeName: textNode.name,
      chars: (textNode.characters || '').substring(0, 60),
      path: path,
      matched: value !== undefined,
      matchedKey: value !== undefined ? value.substring(0, 60) : undefined,
    })
    if (value !== undefined) {
      const normalizedName = normalizeTextKey(textNode.name || '')
      const normalizedChars = normalizeTextKey(textNode.characters || '')
      const isLabelPointer =
        LABEL_POINTER_KEYS.has(normalizedName) || LABEL_POINTER_KEYS.has(normalizedChars)
      const targetNode: TextNode = isLabelPointer
        ? (findSpecsPlaceholder(textNode) || textNode)
        : textNode
      const valueToWrite =
        targetNode !== textNode ? stripLabelPointerPrefix(value, normalizedName || normalizedChars) : value
      try {
        await loadFontsForTextNode(targetNode)
        targetNode.characters = valueToWrite
        if (
          targetNode.textAutoResize === 'HEIGHT' ||
          targetNode.textAutoResize === 'WIDTH_AND_HEIGHT'
        ) {
          targetNode.textAutoResize = 'HEIGHT'
        }
      } catch (_) {}
    }
    return
  }
  if (node.type === 'FRAME' || node.type === 'GROUP') {
    var frame = node as FrameNode
    for (var r = 0; r < frameRenames.length; r++) {
      if (frameRenames[r].oldName === frame.name) {
        frame.name = frameRenames[r].newName
        frameRenames.splice(r, 1)
        break
      }
    }
  }
  var withChildren = node as { children?: readonly BaseNode[] }
  if (withChildren.children && withChildren.children.length) {
    for (var i = 0; i < withChildren.children.length; i++) {
      await applyNodeMapping(withChildren.children[i], mappingEntries, frameRenames)
    }
  }
}

function findSectionInsertionIndex(sectionName: string, allPages: readonly PageNode[]): number {
  var UTILITY_PREFIXES = ['Briefing Template', 'Template', 'Cover', 'Status', 'Safe Zone', 'Export']
  var upper = sectionName.toUpperCase().trim()
  var dividers: Array<{ index: number; name: string }> = []
  for (var i = 0; i < allPages.length; i++) {
    var page = allPages[i]
    var name = page.name.trim()
    if (name.toUpperCase().indexOf('EXP-') === 0) continue
    var skip = false
    for (var j = 0; j < UTILITY_PREFIXES.length; j++) {
      if (name.indexOf(UTILITY_PREFIXES[j]) >= 0) { skip = true; break }
    }
    if (skip) continue
    if (/^[-\u2014\u2013\s*]+$/.test(name)) continue
    dividers.push({ index: i, name: name.toUpperCase() })
  }
  var matchIdx = -1
  for (var i = 0; i < dividers.length; i++) {
    if (dividers[i].name === upper || dividers[i].name.indexOf(upper) >= 0 || upper.indexOf(dividers[i].name) >= 0) {
      matchIdx = i
      break
    }
  }
  if (matchIdx === -1) return -1
  var nextDivider = dividers[matchIdx + 1]
  if (nextDivider) return nextDivider.index
  return allPages.length
}

const TEMPLATE_FONT = { family: 'Inter', style: 'Regular' }

function makeColumnFrame(name: string, width: number): FrameNode {
  const frame = figma.createFrame()
  frame.name = name
  frame.resize(width, 100)
  frame.layoutMode = 'VERTICAL'
  frame.primaryAxisSizingMode = 'AUTO'
  frame.counterAxisSizingMode = 'FIXED'
  frame.counterAxisAlignItems = 'MIN'
  frame.itemSpacing = 8
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 16
  frame.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.96 } }]
  return frame
}

function makeTextNode(name: string, placeholder: string, font: FontName): TextNode {
  const text = figma.createText()
  text.name = name
  text.fontName = font
  text.fontSize = 13
  text.lineHeight = { unit: 'PIXELS', value: 18 }
  text.characters = placeholder
  text.textAutoResize = 'HEIGHT'
  return text
}

function makeBlockFrame(): FrameNode {
  const frame = figma.createFrame()
  frame.name = 'Block'
  frame.layoutMode = 'VERTICAL'
  frame.primaryAxisSizingMode = 'AUTO'
  frame.counterAxisSizingMode = 'FIXED'
  frame.counterAxisAlignItems = 'MIN'
  frame.itemSpacing = 8
  frame.paddingTop = frame.paddingBottom = 8
  frame.paddingLeft = frame.paddingRight = 12
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
  return frame
}

async function createAutoLayoutTemplate(): Promise<{ error?: string }> {
  try {
    await figma.loadFontAsync(TEMPLATE_FONT)
  } catch (e) {
    return { error: 'Could not load Inter font' }
  }
  const font = TEMPLATE_FONT as FontName
  const root = figma.root
  try {

  // Remove existing template page if present
  for (let i = root.children.length - 1; i >= 0; i--) {
    const page = root.children[i]
    if (page.type === 'PAGE' && TEMPLATE_PAGE_NAMES.some((n) => (page as PageNode).name.indexOf(n) >= 0)) {
      page.remove()
      break
    }
  }

  const templatePage = figma.createPage()
  templatePage.name = 'Briefing Template to Duplicate'
  root.appendChild(templatePage)

  const section = figma.createFrame()
  section.name = 'Name Briefing'
  section.layoutMode = 'VERTICAL'
  section.primaryAxisSizingMode = 'AUTO'
  section.counterAxisSizingMode = 'FIXED'
  section.counterAxisAlignItems = 'MIN'
  section.itemSpacing = 12
  section.paddingTop = section.paddingBottom = section.paddingLeft = section.paddingRight = 24
  section.fills = []
  section.resize(2400, 100)
  templatePage.appendChild(section)

  const row = figma.createFrame()
  row.name = 'Columns'
  row.layoutMode = 'HORIZONTAL'
  row.primaryAxisSizingMode = 'AUTO'
  row.counterAxisSizingMode = 'AUTO'
  row.counterAxisAlignItems = 'MIN'
  row.itemSpacing = 40
  row.paddingTop = row.paddingBottom = row.paddingLeft = row.paddingRight = 0
  row.fills = []
  row.resize(2200, 400)
  section.appendChild(row)

  const colW = 400
  const briefingCol = makeColumnFrame('Briefing', colW)
  row.appendChild(briefingCol)
  const briefingBlocks = [
    { label: 'Briefing', value: 'Briefing' },
    { label: 'Not Started', value: 'Not Started' },
    { label: 'Name EXP', value: 'EXP-NAME' },
    { label: 'IDEA:', value: 'IDEA:' },
    { label: 'WHY:', value: 'WHY:' },
    { label: 'AUDIENCE/REGION:', value: 'AUDIENCE/REGION:' },
    { label: 'SEGMENT: ALL', value: 'SEGMENT: ALL' },
    { label: 'FORMATS:', value: 'FORMATS:' },
    { label: 'VARIANTS: 4', value: 'VARIANTS: 4' },
    { label: 'Product:', value: 'Product:' },
    { label: 'Visual', value: null },
    { label: 'Copy info:', value: null },
    { label: 'Note: -', value: 'Note: -' },
    { label: 'Test: -', value: 'Test: -' },
    { label: 'VARIANTS', value: 'VARIANTS' },
  ]
  for (const item of briefingBlocks) {
    const block = makeBlockFrame()
    if (item.value === null) {
      const elements = figma.createFrame()
      elements.name = 'Elements'
      elements.layoutMode = 'VERTICAL'
      elements.primaryAxisSizingMode = 'AUTO'
      elements.counterAxisSizingMode = 'FIXED'
      elements.itemSpacing = 6
      elements.fills = []
      block.appendChild(elements)
      elements.appendChild(makeTextNode(item.label, item.label, font))
      const specs = figma.createFrame()
      specs.name = 'Specs'
      specs.layoutMode = 'VERTICAL'
      specs.primaryAxisSizingMode = 'AUTO'
      specs.counterAxisSizingMode = 'FIXED'
      specs.fills = []
      specs.appendChild(makeTextNode('-', '-', font))
      elements.appendChild(specs)
    } else {
      block.appendChild(makeTextNode(item.label, item.value, font))
    }
    briefingCol.appendChild(block)
  }
  for (const letter of ['A', 'B', 'C', 'D']) {
    const block = makeBlockFrame()
    const text = makeTextNode(`${letter} - Image`, `${letter} - Image`, font)
    block.appendChild(text)
    briefingCol.appendChild(block)
  }

  const copyCol = makeColumnFrame('Copy', colW)
  row.appendChild(copyCol)
  let copyBlock = makeBlockFrame()
  copyCol.appendChild(copyBlock)
  copyBlock.appendChild(makeTextNode('Copy', 'Copy', font))
  copyBlock = makeBlockFrame()
  copyCol.appendChild(copyBlock)
  copyBlock.appendChild(makeTextNode('Not Started', 'Not Started', font))
  for (const letter of ['A', 'B', 'C', 'D']) {
    const varFrame = figma.createFrame()
    varFrame.name = `Variation ${letter}`
    varFrame.layoutMode = 'VERTICAL'
    varFrame.primaryAxisSizingMode = 'AUTO'
    varFrame.counterAxisSizingMode = 'FIXED'
    varFrame.itemSpacing = 10
    varFrame.paddingTop = varFrame.paddingBottom = varFrame.paddingLeft = varFrame.paddingRight = 12
    varFrame.fills = [{ type: 'SOLID', color: { r: 0.92, g: 0.92, b: 0.94 } }]
    varFrame.resize(colW, 100)
    copyCol.appendChild(varFrame)
    let b = makeBlockFrame()
    varFrame.appendChild(b)
    b.appendChild(makeTextNode(`Variation ${letter}`, `Variation ${letter}`, font))
    b = makeBlockFrame()
    varFrame.appendChild(b)
    b.appendChild(makeTextNode('in design copy', 'in design copy', font))
    for (const field of ['headline:', 'subline:', 'CTA:', 'Note:']) {
      b = makeBlockFrame()
      varFrame.appendChild(b)
      b.appendChild(makeTextNode(field, field, font))
    }
  }

  const designCol = makeColumnFrame('Design', 900)
  row.appendChild(designCol)
  let designBlock = makeBlockFrame()
  designCol.appendChild(designBlock)
  designBlock.appendChild(makeTextNode('Design', 'Design', font))
  designBlock = makeBlockFrame()
  designCol.appendChild(designBlock)
  designBlock.appendChild(makeTextNode('Not Started', 'Not Started', font))
  const sizes = ['4x5', '9x16', '1x1']
  for (const letter of ['A', 'B', 'C', 'D']) {
    const varFrame = figma.createFrame()
    varFrame.name = `Variation ${letter}`
    varFrame.layoutMode = 'VERTICAL'
    varFrame.primaryAxisSizingMode = 'AUTO'
    varFrame.counterAxisSizingMode = 'FIXED'
    varFrame.itemSpacing = 12
    varFrame.paddingTop = varFrame.paddingBottom = varFrame.paddingLeft = varFrame.paddingRight = 12
    varFrame.fills = []
    varFrame.resize(900, 100)
    designCol.appendChild(varFrame)
    const assetRow = figma.createFrame()
    assetRow.name = 'Assets'
    assetRow.layoutMode = 'HORIZONTAL'
    assetRow.primaryAxisSizingMode = 'AUTO'
    assetRow.counterAxisSizingMode = 'FIXED'
    assetRow.itemSpacing = 12
    assetRow.fills = []
    assetRow.resize(900, 200)
    varFrame.appendChild(assetRow)
    for (const size of sizes) {
      const f = figma.createFrame()
      f.name = 'NAME-EXP-' + size
      f.resize(size === '4x5' ? 144 : size === '9x16' ? 108 : 144, size === '4x5' ? 180 : size === '9x16' ? 192 : 144)
      f.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
      assetRow.appendChild(f)
    }
  }

  const uploadsCol = makeColumnFrame('Uploads', 280)
  row.appendChild(uploadsCol)
  let uploadsBlock = makeBlockFrame()
  uploadsCol.appendChild(uploadsBlock)
  uploadsBlock.appendChild(makeTextNode('Uploads', 'Uploads', font))
  uploadsBlock = makeBlockFrame()
  uploadsCol.appendChild(uploadsBlock)
  uploadsBlock.appendChild(makeTextNode('Frontify', 'Frontify', font))

  await figma.setCurrentPageAsync(templatePage)
  return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to create template' }
  }
}

interface DebugEntry {
  nodeName: string
  chars: string
  path: string[]
  matched: boolean
  matchedKey?: string
}

var debugLog: DebugEntry[] = []

async function processJobs(jobs: QueuedJob[]): Promise<Array<{ idempotencyKey: string; experimentPageName: string; pageId: string; fileUrl: string; error?: string }>> {
  debugLog = []
  var root = figma.root
  var children = root.children || []
  var templatePage: PageNode | null = null
  for (var i = 0; i < children.length; i++) {
    var node = children[i]
    if (node.type !== 'PAGE') continue
    var pageName = (node as PageNode).name
    for (var j = 0; j < TEMPLATE_PAGE_NAMES.length; j++) {
      if (pageName.indexOf(TEMPLATE_PAGE_NAMES[j]) >= 0 || pageName === TEMPLATE_PAGE_NAMES[j]) {
        templatePage = node as PageNode
        break
      }
    }
    if (templatePage) break
  }

  if (!templatePage) {
    return jobs.map(function (job) {
      return { idempotencyKey: job.idempotencyKey, experimentPageName: job.experimentPageName, pageId: '', fileUrl: '', error: 'No template page found' }
    })
  }

  var fileKey = figma.fileKey || ''
  var results: Array<{ idempotencyKey: string; experimentPageName: string; pageId: string; fileUrl: string; error?: string }> = []

  for (var i = 0; i < jobs.length; i++) {
    var job = jobs[i]
    try {
      var briefing = job.briefingPayload as BriefingPayload
      var targetPage: PageNode | null = null
      var createdNew = false
      for (var e = 0; e < root.children.length; e++) {
        var existing = root.children[e]
        if (existing.type === 'PAGE' && (existing as PageNode).name === job.experimentPageName) {
          targetPage = existing as PageNode
          break
        }
      }

      if (!targetPage) {
        targetPage = templatePage.clone()
        targetPage.name = job.experimentPageName
        createdNew = true
      }
      targetPage.setPluginData('bifrostIdempotencyKey', job.idempotencyKey)
      targetPage.setPluginData('bifrostMondayItemId', job.mondayItemId || '')
      if (briefing.sectionName) {
        targetPage.setPluginData('bifrostSectionName', briefing.sectionName)
        // Only reposition when we just cloned the page.
        if (createdNew) {
          var allPages: PageNode[] = []
          for (var k = 0; k < root.children.length; k++) {
            if (root.children[k].type === 'PAGE') allPages.push(root.children[k] as PageNode)
          }
          var insertAt = findSectionInsertionIndex(briefing.sectionName, allPages)
          if (insertAt >= 0 && insertAt < root.children.length) {
            root.insertChild(insertAt, targetPage)
          }
        }
      }
      var hasMapping = job.nodeMapping && job.nodeMapping.length > 0
      var childCount = 0
      var wc = targetPage as { children?: readonly BaseNode[] }
      if (wc.children) childCount = wc.children.length

      debugLog.push({
        nodeName: '__PLUGIN_META__',
        chars: 'hasMapping=' + !!hasMapping + ' mappingLen=' + (job.nodeMapping ? job.nodeMapping.length : 0) + ' pageChildren=' + childCount + ' pageName=' + targetPage.name + ' createdNew=' + createdNew,
        path: [],
        matched: false,
      })

      if (hasMapping) {
        var mappingEntries: MappingEntry[] = []
        for (var m = 0; m < job.nodeMapping!.length; m++) {
          var key = job.nodeMapping![m].nodeName
          var val = job.nodeMapping![m].value
          mappingEntries.push({
            nodeName: key,
            normalizedNodeName: normalizeTextKey(key),
            value: val,
          })
        }
        await applyNodeMapping(targetPage, mappingEntries, (job.frameRenames || []).slice())
        // Backfill any placeholder-bound fields the model didn't map.
        await fillTextNodes(targetPage, briefing)
      } else {
        await fillTextNodes(targetPage, briefing)
      }
      var pageId = targetPage.id
      var fileUrl = 'https://www.figma.com/file/' + fileKey + '?node-id=' + encodeURIComponent(pageId.replace(':', '-'))
      results.push({ idempotencyKey: job.idempotencyKey, experimentPageName: job.experimentPageName, pageId: pageId, fileUrl: fileUrl })
    } catch (e) {
      results.push({ idempotencyKey: job.idempotencyKey, experimentPageName: job.experimentPageName, pageId: '', fileUrl: '', error: (e instanceof Error ? e.message : 'Unknown error') })
    }
  }

  return results
}

// --- UI HTML (inline) ---
// UI does all HTTP fetching; main thread does Figma operations
var uiHtml = '<html><head><style>'
  + 'body{font-family:Inter,sans-serif;padding:12px;margin:0;}'
  + 'h3{margin:0 0 8px 0;font-size:13px;}'
  + 'button{padding:8px 16px;background:#0d99ff;color:#fff;border:none;border-radius:6px;cursor:pointer;width:100%;font-size:12px;}'
  + 'button:hover{background:#0b85e0;}'
  + '#msg{font-size:11px;color:#666;margin-top:8px;min-height:20px;}'
  + '.err{color:#f24822;}'
  + '</style></head><body>'
  + '<h3>Bifrost Sync</h3>'
  + '<p id="msg">Sync queued briefings from Monday into this file.</p>'
  + '<button id="sync">Sync queued briefings</button>'
  + '<button id="create-template" style="margin-top:8px;">Create Auto-Layout Template</button>'
  + '<script>'
  + 'var BIFROST_API = "http://localhost:3846";'
  + 'var fileKey = "";'
  + 'document.getElementById("sync").onclick = function() {'
  + '  document.getElementById("msg").textContent = "Fetching queued jobs...";'
  + '  document.getElementById("msg").className = "";'
  + '  parent.postMessage({ pluginMessage: { type: "get-file-key" } }, "*");'
  + '};'
  + 'document.getElementById("create-template").onclick = function() {'
  + '  document.getElementById("msg").textContent = "Creating template...";'
  + '  document.getElementById("msg").className = "";'
  + '  parent.postMessage({ pluginMessage: { type: "create-template" } }, "*");'
  + '};'
  + 'function fetchJobs(fk) {'
  + '  fileKey = fk;'
  + '  fetch(BIFROST_API + "/api/jobs/queued?fileKey=" + encodeURIComponent(fk))'
  + '    .then(function(r) { return r.json(); })'
  + '    .then(function(data) {'
  + '      var jobs = data.jobs || [];'
  + '      if (jobs.length === 0) {'
  + '        document.getElementById("msg").textContent = "No queued jobs for this file.";'
  + '        return;'
  + '      }'
  + '      document.getElementById("msg").textContent = "Found " + jobs.length + " job(s). Creating pages...";'
  + '      parent.postMessage({ pluginMessage: { type: "process-jobs", jobs: jobs } }, "*");'
  + '    })'
  + '    .catch(function(e) {'
  + '      document.getElementById("msg").textContent = "Fetch error: " + e.message;'
  + '      document.getElementById("msg").className = "err";'
  + '    });'
  + '}'
  + 'function reportResults(results) {'
  + '  var done = 0; var failed = [];'
  + '  var promises = [];'
  + '  for (var i = 0; i < results.length; i++) {'
  + '    var r = results[i];'
  + '    if (r.error) {'
  + '      failed.push(r.experimentPageName);'
  + '      promises.push(fetch(BIFROST_API + "/api/jobs/fail", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({idempotencyKey: r.idempotencyKey, errorCode: r.error}) }).catch(function(){}));'
  + '    } else {'
  + '      done++;'
  + '      promises.push(fetch(BIFROST_API + "/api/jobs/complete", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({idempotencyKey: r.idempotencyKey, figmaPageId: r.pageId, figmaFileUrl: r.fileUrl}) }).catch(function(){}));'
  + '    }'
  + '  }'
  + '  Promise.all(promises).then(function() {'
  + '    var el = document.getElementById("msg");'
  + '    el.textContent = "Done: " + done + " page(s) created." + (failed.length ? " Failed: " + failed.join(", ") : "");'
  + '    el.className = failed.length ? "err" : "";'
  + '  });'
  + '}'
  + 'onmessage = function(e) {'
  + '  var d = typeof e.data === "object" && e.data.pluginMessage ? e.data.pluginMessage : e.data;'
  + '  if (d.type === "file-key") fetchJobs(d.fileKey);'
  + '  if (d.type === "jobs-processed") reportResults(d.results);'
  + '  if (d.type === "create-template-done") {'
  + '    var el = document.getElementById("msg");'
  + '    el.textContent = d.error ? "Template error: " + d.error : "Template created. You can now sync briefings.";'
  + '    el.className = d.error ? "err" : "";'
  + '  }'
  + '  if (d.type === "debug-log") {'
  + '    var el = document.getElementById("msg");'
  + '    el.style.whiteSpace = "pre-wrap";'
  + '    el.style.fontSize = "9px";'
  + '    el.style.maxHeight = "300px";'
  + '    el.style.overflow = "auto";'
  + '    el.textContent = d.text;'
  + '  }'
  + '};'
  + '</script></body></html>'

figma.showUI(uiHtml, { width: 500, height: 500 })

figma.ui.onmessage = async function (msg: { type: string; jobs?: QueuedJob[] }) {
  if (msg.type === 'get-file-key') {
    figma.ui.postMessage({ type: 'file-key', fileKey: figma.fileKey || '' })
  }
  if (msg.type === 'create-template') {
    const result = await createAutoLayoutTemplate()
    figma.ui.postMessage({ type: 'create-template-done', error: result.error })
  }
  if (msg.type === 'process-jobs' && msg.jobs) {
    var results = await processJobs(msg.jobs)
    figma.ui.postMessage({ type: 'jobs-processed', results: results })
    // Send debug log to UI
    var matched = debugLog.filter(function (d) { return d.matched })
    var unmatched = debugLog.filter(function (d) { return !d.matched })
    var summary = 'DEBUG: ' + matched.length + ' matched, ' + unmatched.length + ' unmatched.\n'
    summary += 'Unmatched nodes (first 20):\n'
    for (var d = 0; d < Math.min(unmatched.length, 20); d++) {
      var u = unmatched[d]
      summary += '  name="' + u.nodeName + '" chars="' + u.chars + '" path=[' + u.path.join(' > ') + ']\n'
    }
    summary += '\nMatched nodes (first 20):\n'
    for (var d = 0; d < Math.min(matched.length, 20); d++) {
      var m = matched[d]
      summary += '  name="' + m.nodeName + '" → "' + (m.matchedKey || '') + '"\n'
    }
    figma.ui.postMessage({ type: 'debug-log', text: summary })
    console.log(summary)
  }
}
