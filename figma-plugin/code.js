"use strict";
/**
 * Bifrost Figma plugin - main thread (code.js).
 * Figma sandbox cannot fetch localhost; all HTTP goes through UI iframe.
 * Main thread handles: Figma API (clone page, fill text, reorder).
 * UI handles: fetch from Bifrost backend, user interaction.
 */
const TEMPLATE_PAGE_NAMES = ['Briefing Template to Duplicate', 'Briefing Template', 'Template'];
function getPlaceholderValue(placeholderId, briefing) {
    var v = briefing.variants || [];
    var map = {
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
    };
    return map[placeholderId] || '';
}
async function loadFontsForTextNode(textNode) {
    var len = textNode.characters.length;
    if (len === 0) {
        // Empty node: load the single font
        var font = textNode.fontName;
        if (font && font.family) {
            await figma.loadFontAsync(font);
        }
        return;
    }
    // Load all fonts used across the text range (mixed fonts possible)
    var loaded = new Set();
    for (var c = 0; c < len; c++) {
        var f = textNode.getRangeFontName(c, c + 1);
        if (f && f.family) {
            var key = f.family + ':' + f.style;
            if (!loaded.has(key)) {
                loaded.add(key);
                await figma.loadFontAsync(f);
            }
        }
    }
}
async function fillTextNodes(node, briefing) {
    if (node.type === 'TEXT') {
        var textNode = node;
        var bifrostId = '';
        try {
            bifrostId = textNode.getPluginData('bifrostId') || textNode.getPluginData('placeholderId');
        }
        catch (_) { }
        if (bifrostId) {
            var value = getPlaceholderValue(bifrostId, briefing);
            // Do not overwrite existing mapped content with empty fallback values.
            if (!value || !value.trim())
                return;
            try {
                await loadFontsForTextNode(textNode);
                textNode.characters = value;
                if (textNode.textAutoResize === 'HEIGHT' ||
                    textNode.textAutoResize === 'WIDTH_AND_HEIGHT') {
                    textNode.textAutoResize = 'HEIGHT';
                }
            }
            catch (_) { }
        }
        return;
    }
    var withChildren = node;
    if (withChildren.children && withChildren.children.length) {
        for (var i = 0; i < withChildren.children.length; i++) {
            await fillTextNodes(withChildren.children[i], briefing);
        }
    }
}
function normalizeTextKey(input) {
    return input.replace(/\s+/g, ' ').trim().toLowerCase();
}
/** Label-as-pointer keys: content goes in sibling Specs > TEXT "-", not in the label node. */
const LABEL_POINTER_KEYS = new Set(['visual', 'copy info:']);
/**
 * Find the sibling Specs frame's TEXT placeholder (the "-" node) for a label node.
 * Structure: parent (e.g. Elements) has label TEXT + FRAME "Specs" with child TEXT "-".
 */
function findSpecsPlaceholder(labelNode) {
    const parent = labelNode.parent;
    if (!parent || !('children' in parent) || !parent.children)
        return null;
    for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        if (child.type !== 'FRAME')
            continue;
        if (child.name !== 'Specs')
            continue;
        const specChildren = child.children || [];
        for (let j = 0; j < specChildren.length; j++) {
            const c = specChildren[j];
            if (c.type === 'TEXT')
                return c;
        }
        return null;
    }
    return null;
}
/** Strip "Visual:" or "Copy info:" prefix from value for label-pointer fields. */
function stripLabelPointerPrefix(value, normalizedKey) {
    if (LABEL_POINTER_KEYS.has(normalizedKey)) {
        return value
            .replace(/^visual\s*:\s*/i, '')
            .replace(/^copy\s+info\s*:\s*/i, '')
            .trim();
    }
    return value;
}
function cleanVariantValue(value, label) {
    const rx = new RegExp(`^\\s*${label}\\s*:\\s*`, 'i');
    return value.replace(rx, '').trim();
}
function getAncestorPath(node) {
    const names = [];
    let current = node;
    while (current && 'parent' in current) {
        const p = current.parent;
        if (!p || p.type === 'DOCUMENT')
            break;
        if ('name' in p && typeof p.name === 'string' && p.name.trim()) {
            names.push(p.name.trim());
        }
        current = p;
    }
    return names.reverse();
}
function buildTextCandidates(textNode) {
    const candidates = new Set();
    const name = textNode.name || '';
    const chars = textNode.characters || '';
    if (name)
        candidates.add(name);
    if (chars)
        candidates.add(chars);
    const path = getAncestorPath(textNode);
    if (path.length > 0) {
        const parent = path[path.length - 1];
        if (name)
            candidates.add(`${parent}::${name}`);
        if (chars)
            candidates.add(`${parent}::${chars}`);
        const full = path.join(' > ');
        if (name)
            candidates.add(`${full}::${name}`);
        if (chars)
            candidates.add(`${full}::${chars}`);
        // Add partial ancestry forms so keys like "Variation A::headline:"
        // still match when there are intermediate wrapper groups.
        for (let i = 0; i < path.length; i++) {
            const partial = path.slice(0, i + 1).join(' > ');
            if (name)
                candidates.add(`${partial}::${name}`);
            if (chars)
                candidates.add(`${partial}::${chars}`);
        }
    }
    return Array.from(candidates);
}
function detectVariationLetter(textNode) {
    const path = getAncestorPath(textNode);
    for (let i = path.length - 1; i >= 0; i--) {
        const m = /variation\s*([A-D])/i.exec(path[i]);
        if (m)
            return m[1].toUpperCase();
    }
    return null;
}
function consumeScopedMapping(mappingEntries, variation, suffix) {
    const preferredSuffixes = [
        normalizeTextKey(`copy > variation ${variation}::${suffix}`),
        normalizeTextKey(`variation ${variation}::${suffix}`),
    ];
    for (const target of preferredSuffixes) {
        for (let i = 0; i < mappingEntries.length; i++) {
            const entry = mappingEntries[i];
            if (entry.used)
                continue;
            if (entry.normalizedNodeName !== target)
                continue;
            entry.used = true;
            return entry.value;
        }
    }
    return undefined;
}
function patchInlineLabelValue(text, label, value) {
    if (!value)
        return text;
    const lines = text.split('\n');
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (new RegExp(`^\\s*${label}\\s*:`, 'i').test(line)) {
            lines[i] = `${label}: ${value}`;
            changed = true;
            break;
        }
    }
    return changed ? lines.join('\n') : text;
}
function tryComposeVariationInline(textNode, mappingEntries) {
    const variation = detectVariationLetter(textNode);
    if (!variation)
        return undefined;
    let next = textNode.characters;
    const norm = normalizeTextKey(next);
    const h = consumeScopedMapping(mappingEntries, variation, 'headline:');
    const s = consumeScopedMapping(mappingEntries, variation, 'subline:');
    const c = consumeScopedMapping(mappingEntries, variation, 'cta:');
    const n = consumeScopedMapping(mappingEntries, variation, 'note:');
    // Multi-label text block (headline/subline/CTA in one node)
    if (norm.includes('headline:') && norm.includes('subline:') && norm.includes('cta:')) {
        next = patchInlineLabelValue(next, 'headline', h ? cleanVariantValue(h, 'headline') : undefined);
        next = patchInlineLabelValue(next, 'subline', s ? cleanVariantValue(s, 'subline') : undefined);
        next = patchInlineLabelValue(next, 'CTA', c ? cleanVariantValue(c, 'cta') : undefined);
    }
    // Dedicated note line/block
    if (norm.includes('note:')) {
        next = patchInlineLabelValue(next, 'Note', n ? cleanVariantValue(n, 'note') : undefined);
    }
    return next !== textNode.characters ? next : undefined;
}
function pickMappedValue(textNode, mappingEntries) {
    const path = getAncestorPath(textNode);
    const candidates = buildTextCandidates(textNode).map(normalizeTextKey);
    for (const candidate of candidates) {
        for (let i = 0; i < mappingEntries.length; i++) {
            const entry = mappingEntries[i];
            if (entry.used)
                continue;
            if (entry.normalizedNodeName !== candidate)
                continue;
            entry.used = true;
            return entry.value;
        }
    }
    // Fallback for duplicate label fields in Copy variation cards:
    // consume Variation A/B/C/D scoped mappings in traversal order.
    const inCopyOrVariation = path.some((p) => {
        const n = normalizeTextKey(p);
        return n.includes('copy') || n.includes('variation');
    });
    if (inCopyOrVariation) {
        const nameOrChars = [normalizeTextKey(textNode.name || ''), normalizeTextKey(textNode.characters || '')];
        const consumeBySuffix = (suffix) => {
            for (let i = 0; i < mappingEntries.length; i++) {
                const entry = mappingEntries[i];
                if (entry.used)
                    continue;
                if (!entry.normalizedNodeName.endsWith(suffix))
                    continue;
                entry.used = true;
                return entry.value;
            }
            return undefined;
        };
        if (nameOrChars.includes('headline:'))
            return consumeBySuffix('::headline:');
        if (nameOrChars.includes('subline:'))
            return consumeBySuffix('::subline:');
        if (nameOrChars.includes('cta:'))
            return consumeBySuffix('::cta:');
        if (nameOrChars.includes('note:'))
            return consumeBySuffix('::note:');
    }
    return undefined;
}
async function applyNodeMapping(node, mappingEntries, frameRenames) {
    if (node.type === 'TEXT') {
        var textNode = node;
        var path = getAncestorPath(textNode);
        var value = pickMappedValue(textNode, mappingEntries);
        if (value === undefined) {
            value = tryComposeVariationInline(textNode, mappingEntries);
        }
        debugLog.push({
            nodeName: textNode.name,
            chars: (textNode.characters || '').substring(0, 60),
            path: path,
            matched: value !== undefined,
            matchedKey: value !== undefined ? value.substring(0, 60) : undefined,
        });
        if (value !== undefined) {
            const normalizedName = normalizeTextKey(textNode.name || '');
            const normalizedChars = normalizeTextKey(textNode.characters || '');
            const isLabelPointer = LABEL_POINTER_KEYS.has(normalizedName) || LABEL_POINTER_KEYS.has(normalizedChars);
            const targetNode = isLabelPointer
                ? (findSpecsPlaceholder(textNode) || textNode)
                : textNode;
            const valueToWrite = targetNode !== textNode ? stripLabelPointerPrefix(value, normalizedName || normalizedChars) : value;
            try {
                await loadFontsForTextNode(targetNode);
                targetNode.characters = valueToWrite;
                if (targetNode.textAutoResize === 'HEIGHT' ||
                    targetNode.textAutoResize === 'WIDTH_AND_HEIGHT') {
                    targetNode.textAutoResize = 'HEIGHT';
                }
            }
            catch (_) { }
        }
        return;
    }
    if (node.type === 'FRAME' || node.type === 'GROUP') {
        var frame = node;
        for (var r = 0; r < frameRenames.length; r++) {
            if (frameRenames[r].oldName === frame.name) {
                frame.name = frameRenames[r].newName;
                frameRenames.splice(r, 1);
                break;
            }
        }
    }
    var withChildren = node;
    if (withChildren.children && withChildren.children.length) {
        for (var i = 0; i < withChildren.children.length; i++) {
            await applyNodeMapping(withChildren.children[i], mappingEntries, frameRenames);
        }
    }
}
function findSectionInsertionIndex(sectionName, allPages) {
    var UTILITY_PREFIXES = ['Briefing Template', 'Template', 'Cover', 'Status', 'Safe Zone', 'Export'];
    var upper = sectionName.toUpperCase().trim();
    var dividers = [];
    for (var i = 0; i < allPages.length; i++) {
        var page = allPages[i];
        var name = page.name.trim();
        if (name.toUpperCase().indexOf('EXP-') === 0)
            continue;
        var skip = false;
        for (var j = 0; j < UTILITY_PREFIXES.length; j++) {
            if (name.indexOf(UTILITY_PREFIXES[j]) >= 0) {
                skip = true;
                break;
            }
        }
        if (skip)
            continue;
        if (/^[-\u2014\u2013\s*]+$/.test(name))
            continue;
        dividers.push({ index: i, name: name.toUpperCase() });
    }
    var matchIdx = -1;
    for (var i = 0; i < dividers.length; i++) {
        if (dividers[i].name === upper || dividers[i].name.indexOf(upper) >= 0 || upper.indexOf(dividers[i].name) >= 0) {
            matchIdx = i;
            break;
        }
    }
    if (matchIdx === -1)
        return -1;
    var nextDivider = dividers[matchIdx + 1];
    if (nextDivider)
        return nextDivider.index;
    return allPages.length;
}
const TEMPLATE_FONT = { family: 'Inter', style: 'Regular' };
function makeColumnFrame(name, width) {
    const frame = figma.createFrame();
    frame.name = name;
    frame.resize(width, 100);
    frame.layoutMode = 'VERTICAL';
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'FIXED';
    frame.counterAxisAlignItems = 'MIN';
    frame.itemSpacing = 8;
    frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 16;
    frame.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.96 } }];
    return frame;
}
function makeTextNode(name, placeholder, font) {
    const text = figma.createText();
    text.name = name;
    text.fontName = font;
    text.fontSize = 13;
    text.lineHeight = { unit: 'PIXELS', value: 18 };
    text.characters = placeholder;
    text.textAutoResize = 'HEIGHT';
    return text;
}
function makeBlockFrame() {
    const frame = figma.createFrame();
    frame.name = 'Block';
    frame.layoutMode = 'VERTICAL';
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'FIXED';
    frame.counterAxisAlignItems = 'MIN';
    frame.itemSpacing = 8;
    frame.paddingTop = frame.paddingBottom = 8;
    frame.paddingLeft = frame.paddingRight = 12;
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    return frame;
}
/** Append a child to an auto-layout parent and set it to stretch/fill cross-axis. */
function appendAndStretch(parent, child) {
    parent.appendChild(child);
    try {
        child.layoutAlign = 'STRETCH';
    }
    catch (_) { }
}
async function createAutoLayoutTemplate() {
    try {
        await figma.loadFontAsync(TEMPLATE_FONT);
    }
    catch (e) {
        return { error: 'Could not load Inter font' };
    }
    const font = TEMPLATE_FONT;
    const root = figma.root;
    try {
        // Remove existing template page if present
        for (let i = root.children.length - 1; i >= 0; i--) {
            const page = root.children[i];
            if (page.type === 'PAGE' && TEMPLATE_PAGE_NAMES.some((n) => page.name.indexOf(n) >= 0)) {
                page.remove();
                break;
            }
        }
        const templatePage = figma.createPage();
        templatePage.name = 'Briefing Template to Duplicate';
        root.appendChild(templatePage);
        const section = figma.createFrame();
        section.name = 'Name Briefing';
        section.layoutMode = 'VERTICAL';
        section.primaryAxisSizingMode = 'AUTO';
        section.counterAxisSizingMode = 'FIXED';
        section.counterAxisAlignItems = 'MIN';
        section.itemSpacing = 12;
        section.paddingTop = section.paddingBottom = section.paddingLeft = section.paddingRight = 24;
        section.fills = [];
        section.resize(2400, 100);
        templatePage.appendChild(section);
        const row = figma.createFrame();
        row.name = 'Columns';
        row.layoutMode = 'HORIZONTAL';
        row.primaryAxisSizingMode = 'AUTO';
        row.counterAxisSizingMode = 'AUTO';
        row.counterAxisAlignItems = 'MIN';
        row.itemSpacing = 40;
        row.paddingTop = row.paddingBottom = row.paddingLeft = row.paddingRight = 0;
        row.fills = [];
        row.resize(2200, 400);
        section.appendChild(row);
        const colW = 400;
        const briefingCol = makeColumnFrame('Briefing', colW);
        row.appendChild(briefingCol);
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
        ];
        for (const item of briefingBlocks) {
            const block = makeBlockFrame();
            if (item.value === null) {
                const elements = figma.createFrame();
                elements.name = 'Elements';
                elements.layoutMode = 'VERTICAL';
                elements.primaryAxisSizingMode = 'AUTO';
                elements.counterAxisSizingMode = 'FIXED';
                elements.itemSpacing = 6;
                elements.fills = [];
                appendAndStretch(block, elements);
                const label = makeTextNode(item.label, item.label, font);
                appendAndStretch(elements, label);
                const specs = figma.createFrame();
                specs.name = 'Specs';
                specs.layoutMode = 'VERTICAL';
                specs.primaryAxisSizingMode = 'AUTO';
                specs.counterAxisSizingMode = 'FIXED';
                specs.fills = [];
                appendAndStretch(elements, specs);
                const dash = makeTextNode('-', '-', font);
                appendAndStretch(specs, dash);
            }
            else {
                const tn = makeTextNode(item.label, item.value, font);
                appendAndStretch(block, tn);
            }
            appendAndStretch(briefingCol, block);
        }
        for (const letter of ['A', 'B', 'C', 'D']) {
            const block = makeBlockFrame();
            const text = makeTextNode(`${letter} - Image`, `${letter} - Image`, font);
            appendAndStretch(block, text);
            appendAndStretch(briefingCol, block);
        }
        const copyCol = makeColumnFrame('Copy', colW);
        row.appendChild(copyCol);
        let copyBlock = makeBlockFrame();
        appendAndStretch(copyCol, copyBlock);
        appendAndStretch(copyBlock, makeTextNode('Copy', 'Copy', font));
        copyBlock = makeBlockFrame();
        appendAndStretch(copyCol, copyBlock);
        appendAndStretch(copyBlock, makeTextNode('Not Started', 'Not Started', font));
        for (const letter of ['A', 'B', 'C', 'D']) {
            const varFrame = figma.createFrame();
            varFrame.name = `Variation ${letter}`;
            varFrame.layoutMode = 'VERTICAL';
            varFrame.primaryAxisSizingMode = 'AUTO';
            varFrame.counterAxisSizingMode = 'FIXED';
            varFrame.itemSpacing = 10;
            varFrame.paddingTop = varFrame.paddingBottom = varFrame.paddingLeft = varFrame.paddingRight = 12;
            varFrame.fills = [{ type: 'SOLID', color: { r: 0.92, g: 0.92, b: 0.94 } }];
            varFrame.resize(colW, 100);
            appendAndStretch(copyCol, varFrame);
            let b = makeBlockFrame();
            appendAndStretch(varFrame, b);
            appendAndStretch(b, makeTextNode(`Variation ${letter}`, `Variation ${letter}`, font));
            b = makeBlockFrame();
            appendAndStretch(varFrame, b);
            appendAndStretch(b, makeTextNode('in design copy', 'in design copy', font));
            for (const field of ['headline:', 'subline:', 'CTA:', 'Note:']) {
                b = makeBlockFrame();
                appendAndStretch(varFrame, b);
                appendAndStretch(b, makeTextNode(field, field, font));
            }
        }
        const designCol = makeColumnFrame('Design', 900);
        row.appendChild(designCol);
        let designBlock = makeBlockFrame();
        appendAndStretch(designCol, designBlock);
        appendAndStretch(designBlock, makeTextNode('Design', 'Design', font));
        designBlock = makeBlockFrame();
        appendAndStretch(designCol, designBlock);
        appendAndStretch(designBlock, makeTextNode('Not Started', 'Not Started', font));
        const sizes = ['4x5', '9x16', '1x1'];
        for (const letter of ['A', 'B', 'C', 'D']) {
            const varFrame = figma.createFrame();
            varFrame.name = `Variation ${letter}`;
            varFrame.layoutMode = 'VERTICAL';
            varFrame.primaryAxisSizingMode = 'AUTO';
            varFrame.counterAxisSizingMode = 'FIXED';
            varFrame.itemSpacing = 12;
            varFrame.paddingTop = varFrame.paddingBottom = varFrame.paddingLeft = varFrame.paddingRight = 12;
            varFrame.fills = [];
            varFrame.resize(900, 100);
            appendAndStretch(designCol, varFrame);
            const assetRow = figma.createFrame();
            assetRow.name = 'Assets';
            assetRow.layoutMode = 'HORIZONTAL';
            assetRow.primaryAxisSizingMode = 'AUTO';
            assetRow.counterAxisSizingMode = 'FIXED';
            assetRow.itemSpacing = 12;
            assetRow.fills = [];
            assetRow.resize(900, 200);
            appendAndStretch(varFrame, assetRow);
            for (const size of sizes) {
                const f = figma.createFrame();
                f.name = 'NAME-EXP-' + size;
                f.resize(size === '4x5' ? 144 : size === '9x16' ? 108 : 144, size === '4x5' ? 180 : size === '9x16' ? 192 : 144);
                f.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
                assetRow.appendChild(f); // asset frames: do NOT stretch (keep design ratio sizes)
            }
        }
        const uploadsCol = makeColumnFrame('Uploads', 280);
        row.appendChild(uploadsCol);
        let uploadsBlock = makeBlockFrame();
        appendAndStretch(uploadsCol, uploadsBlock);
        appendAndStretch(uploadsBlock, makeTextNode('Uploads', 'Uploads', font));
        uploadsBlock = makeBlockFrame();
        appendAndStretch(uploadsCol, uploadsBlock);
        appendAndStretch(uploadsBlock, makeTextNode('Frontify', 'Frontify', font));
        await figma.setCurrentPageAsync(templatePage);
        return {};
    }
    catch (e) {
        return { error: e instanceof Error ? e.message : 'Failed to create template' };
    }
}
/**
 * Detect whether children of a frame are arranged in a vertical stack,
 * horizontal row, or free-form (overlapping / absolute).
 */
function detectChildArrangement(frame) {
    const kids = frame.children.filter((c) => c.visible !== false);
    if (kids.length < 2)
        return 'VERTICAL'; // single child → treat as vertical
    // Check vertical stacking: each child starts at/below previous bottom
    const sortedY = [...kids].sort((a, b) => a.y - b.y);
    let vertPairs = 0;
    for (let i = 1; i < sortedY.length; i++) {
        if (sortedY[i].y >= sortedY[i - 1].y + sortedY[i - 1].height - 4)
            vertPairs++;
    }
    // Check horizontal stacking: each child starts at/after previous right edge
    const sortedX = [...kids].sort((a, b) => a.x - b.x);
    let horizPairs = 0;
    for (let i = 1; i < sortedX.length; i++) {
        if (sortedX[i].x >= sortedX[i - 1].x + sortedX[i - 1].width - 4)
            horizPairs++;
    }
    const threshold = (kids.length - 1) * 0.6;
    if (vertPairs >= threshold)
        return 'VERTICAL';
    if (horizPairs >= threshold)
        return 'HORIZONTAL';
    return 'NONE';
}
/**
 * Calculate the median spacing between consecutive children along an axis.
 */
function medianChildSpacing(frame, dir) {
    const kids = frame.children.filter((c) => c.visible !== false);
    if (kids.length < 2)
        return 8;
    const sorted = [...kids].sort((a, b) => dir === 'VERTICAL' ? a.y - b.y : a.x - b.x);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
        const gap = dir === 'VERTICAL'
            ? sorted[i].y - (sorted[i - 1].y + sorted[i - 1].height)
            : sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width);
        if (gap >= 0)
            gaps.push(gap);
    }
    if (gaps.length === 0)
        return 8;
    gaps.sort((a, b) => a - b);
    return Math.round(gaps[Math.floor(gaps.length / 2)]);
}
/**
 * Estimate frame padding by examining child positions relative to frame bounds.
 */
function estimateFramePadding(frame) {
    const kids = frame.children.filter((c) => c.visible !== false);
    if (kids.length === 0)
        return { top: 0, left: 0, bottom: 0, right: 0 };
    let minX = Infinity, minY = Infinity, maxR = 0, maxB = 0;
    for (const k of kids) {
        minX = Math.min(minX, k.x);
        minY = Math.min(minY, k.y);
        maxR = Math.max(maxR, k.x + k.width);
        maxB = Math.max(maxB, k.y + k.height);
    }
    return {
        top: Math.max(0, Math.round(minY)),
        left: Math.max(0, Math.round(minX)),
        bottom: Math.max(0, Math.round(frame.height - maxB)),
        right: Math.max(0, Math.round(frame.width - maxR)),
    };
}
/**
 * Should we skip this frame from auto-layout conversion?
 * Skips: asset frames (4x5), empty frames, frames without text/frame children.
 */
function shouldSkipAutoLayout(frame) {
    const name = frame.name.toLowerCase();
    // Asset frames with ratio names (design canvases)
    if (/\d+x\d+/.test(name))
        return true;
    // No children
    if (!frame.children || frame.children.length === 0)
        return true;
    // Already has auto-layout
    if (frame.layoutMode !== 'NONE')
        return false;
    // No structural children (only rects/vectors/images)
    return !frame.children.some((c) => c.type === 'TEXT' || c.type === 'FRAME' || c.type === 'GROUP');
}
/**
 * Phase 1: Walk all text nodes and enable vertical auto-resize.
 * This lets Figma compute the actual height each text node needs.
 * Must run first so child heights are correct before frame sizing.
 */
async function phaseFixTextNodes(node) {
    let count = 0;
    if (node.type === 'TEXT') {
        const tn = node;
        if (tn.characters && tn.characters.trim().length > 0 && tn.textAutoResize !== 'HEIGHT') {
            try {
                await loadFontsForTextNode(tn);
                tn.textAutoResize = 'HEIGHT';
                count++;
            }
            catch (_) { }
        }
    }
    const container = node;
    if (container.children) {
        for (const child of container.children) {
            count += await phaseFixTextNodes(child);
        }
    }
    return count;
}
/**
 * Phase 2: Bottom-up auto-layout conversion.
 * For non-auto-layout frames with vertically/horizontally stacked children,
 * detect the pattern, sort children to match visual order, enable auto-layout
 * with inferred spacing and padding.
 */
function phaseEnableAutoLayout(node, analysis) {
    const container = node;
    if (container.children) {
        for (const child of container.children) {
            phaseEnableAutoLayout(child, analysis);
        }
    }
    if (node.type !== 'FRAME')
        return;
    const frame = node;
    if (frame.layoutMode !== 'NONE')
        return; // already has auto-layout
    if (shouldSkipAutoLayout(frame)) {
        analysis.skippedFrames.push(frame.name);
        return;
    }
    const arrangement = detectChildArrangement(frame);
    if (arrangement === 'NONE') {
        analysis.skippedFrames.push(frame.name);
        return;
    }
    // Infer spacing and padding from current positions
    const spacing = medianChildSpacing(frame, arrangement);
    const padding = estimateFramePadding(frame);
    const savedWidth = frame.width;
    const savedHeight = frame.height;
    // Sort children to match visual order before enabling auto-layout.
    // In Figma, auto-layout flows children in array order; we need
    // that order to match the visual top→bottom / left→right order.
    const sorted = [...frame.children].sort((a, b) => arrangement === 'VERTICAL'
        ? a.y - b.y
        : a.x - b.x);
    for (let i = 0; i < sorted.length; i++) {
        frame.insertChild(i, sorted[i]);
    }
    // Enable auto-layout with detected settings
    frame.layoutMode = arrangement;
    frame.primaryAxisSizingMode = 'AUTO'; // hug content (grows with children)
    frame.counterAxisSizingMode = 'FIXED'; // keep cross-axis size
    frame.counterAxisAlignItems = 'MIN';
    frame.itemSpacing = Math.max(spacing, 4);
    frame.paddingTop = padding.top;
    frame.paddingBottom = Math.max(padding.bottom, 4);
    frame.paddingLeft = padding.left;
    frame.paddingRight = padding.right;
    // Restore the cross-axis dimension
    if (arrangement === 'VERTICAL') {
        frame.resize(savedWidth, frame.height);
    }
    else {
        frame.resize(frame.width, savedHeight);
    }
    analysis.framesConverted++;
}
/**
 * Phase 3: For frames already with auto-layout, ensure they hug content.
 *
 * VERTICAL frames: primaryAxis (height) = AUTO, counterAxis (width) = FIXED
 *   → grows vertically with children, keeps fixed column width
 * HORIZONTAL frames: primaryAxis (width) = AUTO, counterAxis (height) = AUTO
 *   → grows horizontally with children AND vertically to match tallest child
 *
 * This ensures the Columns row expands to show the full Briefing column.
 */
function phaseEnsureHugContent(node, analysis) {
    if (node.type === 'FRAME') {
        const frame = node;
        if (frame.layoutMode !== 'NONE') {
            // Primary axis: always hug content
            if (frame.primaryAxisSizingMode !== 'AUTO') {
                frame.primaryAxisSizingMode = 'AUTO';
                analysis.framesHugged++;
            }
            // Counter axis: for HORIZONTAL frames, also hug so height grows
            // to match the tallest child (e.g., Columns row matches Briefing col)
            if (frame.layoutMode === 'HORIZONTAL' && frame.counterAxisSizingMode !== 'AUTO') {
                frame.counterAxisSizingMode = 'AUTO';
                analysis.framesHugged++;
            }
        }
    }
    const container = node;
    if (container.children) {
        for (const child of container.children) {
            phaseEnsureHugContent(child, analysis);
        }
    }
}
/**
 * Phase 4: Stretch children to fill parent cross-axis.
 * In VERTICAL auto-layout frames, children should fill the parent width
 * so text blocks use the full column width instead of staying at 100px.
 * Skips asset frames (design canvases) and HORIZONTAL layout children.
 */
function phaseStretchChildren(node) {
    let count = 0;
    if (node.type === 'FRAME') {
        const frame = node;
        // Only stretch in VERTICAL layouts — makes children fill width.
        // In HORIZONTAL layouts, children keep their own width.
        if (frame.layoutMode === 'VERTICAL') {
            for (let i = 0; i < frame.children.length; i++) {
                const child = frame.children[i];
                // Skip asset frames (design canvases like 4x5, 9x16)
                if (/\d+x\d+/.test(child.name))
                    continue;
                if (child.type === 'FRAME' || child.type === 'TEXT' || child.type === 'GROUP') {
                    try {
                        if (child.layoutAlign !== 'STRETCH') {
                            child.layoutAlign = 'STRETCH';
                            count++;
                        }
                    }
                    catch (_) { }
                }
            }
        }
    }
    const container = node;
    if (container.children) {
        for (const child of container.children) {
            count += phaseStretchChildren(child);
        }
    }
    return count;
}
/**
 * Phase 5: Disable clipsContent on structural auto-layout frames.
 * Ensures content is never hidden even during layout recalculation.
 * Skips asset frames (design canvases) that need clipping.
 */
function phaseDisableClipping(node) {
    let count = 0;
    if (node.type === 'FRAME') {
        const frame = node;
        if (frame.layoutMode !== 'NONE' && frame.clipsContent) {
            // Skip asset-related frames
            if (!/\d+x\d+/.test(frame.name)) {
                frame.clipsContent = false;
                count++;
            }
        }
    }
    const container = node;
    if (container.children) {
        for (const child of container.children) {
            count += phaseDisableClipping(child);
        }
    }
    return count;
}
/**
 * Main entry: Smart Layout Normalization.
 * Five-phase process that runs after content fill to ensure
 * all components scale proportionally with their content.
 *
 * Phase 1 — Text: auto-resize HEIGHT on all text nodes (vertical growth)
 * Phase 2 — Frames: detect stacked patterns, enable auto-layout (bottom-up)
 * Phase 3 — Hug: ensure all auto-layout frames grow with children (both axes)
 * Phase 4 — Stretch: children fill parent width (no more 100px cramming)
 * Phase 5 — Unclip: disable clipsContent so nothing is hidden
 */
async function normalizeLayout(root) {
    const analysis = {
        textNodesFixed: 0,
        framesConverted: 0,
        framesHugged: 0,
        childrenStretched: 0,
        skippedFrames: [],
    };
    // Phase 1: text nodes — must be first so heights settle
    analysis.textNodesFixed = await phaseFixTextNodes(root);
    // Phase 2: bottom-up auto-layout on stacked frames
    phaseEnableAutoLayout(root, analysis);
    // Phase 3: existing auto-layout frames → hug content on both axes
    phaseEnsureHugContent(root, analysis);
    // Phase 4: stretch children to fill parent width
    analysis.childrenStretched = phaseStretchChildren(root);
    // Phase 5: disable clipping on structural frames
    phaseDisableClipping(root);
    return analysis;
}
var debugLog = [];
async function processJobs(jobs) {
    debugLog = [];
    var root = figma.root;
    var children = root.children || [];
    var templatePage = null;
    for (var i = 0; i < children.length; i++) {
        var node = children[i];
        if (node.type !== 'PAGE')
            continue;
        var pageName = node.name;
        for (var j = 0; j < TEMPLATE_PAGE_NAMES.length; j++) {
            if (pageName.indexOf(TEMPLATE_PAGE_NAMES[j]) >= 0 || pageName === TEMPLATE_PAGE_NAMES[j]) {
                templatePage = node;
                break;
            }
        }
        if (templatePage)
            break;
    }
    if (!templatePage) {
        return jobs.map(function (job) {
            return { idempotencyKey: job.idempotencyKey, experimentPageName: job.experimentPageName, pageId: '', fileUrl: '', error: 'No template page found' };
        });
    }
    var fileKey = figma.fileKey || '';
    var results = [];
    for (var i = 0; i < jobs.length; i++) {
        var job = jobs[i];
        try {
            var briefing = job.briefingPayload;
            var targetPage = null;
            var createdNew = false;
            for (var e = 0; e < root.children.length; e++) {
                var existing = root.children[e];
                if (existing.type === 'PAGE' && existing.name === job.experimentPageName) {
                    targetPage = existing;
                    break;
                }
            }
            if (!targetPage) {
                targetPage = templatePage.clone();
                targetPage.name = job.experimentPageName;
                createdNew = true;
            }
            targetPage.setPluginData('bifrostIdempotencyKey', job.idempotencyKey);
            targetPage.setPluginData('bifrostMondayItemId', job.mondayItemId || '');
            if (briefing.sectionName) {
                targetPage.setPluginData('bifrostSectionName', briefing.sectionName);
                // Only reposition when we just cloned the page.
                if (createdNew) {
                    var allPages = [];
                    for (var k = 0; k < root.children.length; k++) {
                        if (root.children[k].type === 'PAGE')
                            allPages.push(root.children[k]);
                    }
                    var insertAt = findSectionInsertionIndex(briefing.sectionName, allPages);
                    if (insertAt >= 0 && insertAt < root.children.length) {
                        root.insertChild(insertAt, targetPage);
                    }
                }
            }
            var hasMapping = job.nodeMapping && job.nodeMapping.length > 0;
            var childCount = 0;
            var wc = targetPage;
            if (wc.children)
                childCount = wc.children.length;
            debugLog.push({
                nodeName: '__PLUGIN_META__',
                chars: 'hasMapping=' + !!hasMapping + ' mappingLen=' + (job.nodeMapping ? job.nodeMapping.length : 0) + ' pageChildren=' + childCount + ' pageName=' + targetPage.name + ' createdNew=' + createdNew,
                path: [],
                matched: false,
            });
            if (hasMapping) {
                var mappingEntries = [];
                for (var m = 0; m < job.nodeMapping.length; m++) {
                    var key = job.nodeMapping[m].nodeName;
                    var val = job.nodeMapping[m].value;
                    mappingEntries.push({
                        nodeName: key,
                        normalizedNodeName: normalizeTextKey(key),
                        value: val,
                    });
                }
                await applyNodeMapping(targetPage, mappingEntries, (job.frameRenames || []).slice());
                // Backfill any placeholder-bound fields the model didn't map.
                await fillTextNodes(targetPage, briefing);
            }
            else {
                await fillTextNodes(targetPage, briefing);
            }
            // ── Smart Layout Normalization ──
            // Analyze how content is placed and proportionally adjust frames,
            // text nodes, and spacing to prevent cramming/overflow.
            var layoutResult = await normalizeLayout(targetPage);
            debugLog.push({
                nodeName: '__LAYOUT_NORM__',
                chars: 'textFixed=' + layoutResult.textNodesFixed
                    + ' framesConverted=' + layoutResult.framesConverted
                    + ' framesHugged=' + layoutResult.framesHugged
                    + ' stretched=' + layoutResult.childrenStretched
                    + ' skipped=[' + layoutResult.skippedFrames.slice(0, 5).join(', ') + ']',
                path: [],
                matched: true,
            });
            var pageId = targetPage.id;
            var fileUrl = 'https://www.figma.com/file/' + fileKey + '?node-id=' + encodeURIComponent(pageId.replace(':', '-'));
            results.push({ idempotencyKey: job.idempotencyKey, experimentPageName: job.experimentPageName, pageId: pageId, fileUrl: fileUrl });
        }
        catch (e) {
            results.push({ idempotencyKey: job.idempotencyKey, experimentPageName: job.experimentPageName, pageId: '', fileUrl: '', error: (e instanceof Error ? e.message : 'Unknown error') });
        }
    }
    return results;
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
    + '        document.getElementById("msg").textContent = "No file-specific jobs. Checking all queued...";'
    + '        return fetch(BIFROST_API + "/api/jobs/queued").then(function(r2){return r2.json();}).then(function(d2){'
    + '          var all = d2.jobs || [];'
    + '          if (all.length === 0) { document.getElementById("msg").textContent = "No queued jobs."; return; }'
    + '          document.getElementById("msg").textContent = "Found " + all.length + " job(s) (cross-file). Creating pages...";'
    + '          parent.postMessage({ pluginMessage: { type: "process-jobs", jobs: all } }, "*");'
    + '        });'
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
    + '</script></body></html>';
figma.showUI(uiHtml, { width: 500, height: 500 });
figma.ui.onmessage = async function (msg) {
    if (msg.type === 'get-file-key') {
        figma.ui.postMessage({ type: 'file-key', fileKey: figma.fileKey || '' });
    }
    if (msg.type === 'create-template') {
        const result = await createAutoLayoutTemplate();
        figma.ui.postMessage({ type: 'create-template-done', error: result.error });
    }
    if (msg.type === 'process-jobs' && msg.jobs) {
        var results = await processJobs(msg.jobs);
        figma.ui.postMessage({ type: 'jobs-processed', results: results });
        // Send debug log to UI
        var matched = debugLog.filter(function (d) { return d.matched; });
        var unmatched = debugLog.filter(function (d) { return !d.matched; });
        var summary = 'DEBUG: ' + matched.length + ' matched, ' + unmatched.length + ' unmatched.\n';
        summary += 'Unmatched nodes (first 20):\n';
        for (var d = 0; d < Math.min(unmatched.length, 20); d++) {
            var u = unmatched[d];
            summary += '  name="' + u.nodeName + '" chars="' + u.chars + '" path=[' + u.path.join(' > ') + ']\n';
        }
        summary += '\nMatched nodes (first 20):\n';
        for (var d = 0; d < Math.min(matched.length, 20); d++) {
            var m = matched[d];
            summary += '  name="' + m.nodeName + '" → "' + (m.matchedKey || '') + '"\n';
        }
        figma.ui.postMessage({ type: 'debug-log', text: summary });
        console.log(summary);
    }
};
