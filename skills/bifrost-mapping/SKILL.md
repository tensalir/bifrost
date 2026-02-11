---
name: bifrost-mapping
description: Maps Monday.com experiment item data and optional Brief doc content onto Figma briefing template node names. Use when generating textMappings and frameRenames for Bifrost sync jobs, or when the user asks to map Monday fields to Figma template fields.
---

# Bifrost Monday-to-Figma Mapping

## Output format

Return exactly two arrays:

1. **textMappings**: `Array<{ nodeName: string, value: string }>` — mapping key to text value.
   - Preferred key forms:
     - Plain node label: `IDEA:`, `AUDIENCE/REGION:`, `headline:`
     - Parent-scoped key for duplicate labels: `Variation A::headline:`
     - Full path key when needed: `Copy > Variation A::headline:`
2. **frameRenames**: `Array<{ oldName: string, newName: string }>` — FRAME node names to rename (e.g. `NAME-EXP-4x5` → `{experimentName}-A-4x5`).

Match labels exactly as they appear in the template tree. For duplicate labels (e.g. `headline:` appears in multiple frames), use parent/path-scoped keys.
Only include entries for nodes you have data for; omit nodes with no source data (plugin will leave them unchanged).

---

## Figma template node reference

### Briefing header (single value per node)

| Node name | Semantic role | Source |
|-----------|---------------|--------|
| Name EXP | Experiment identifier | Monday item `name` |
| IDEA: | Brief idea / concept | Monday Doc or columns |
| WHY: | Rationale | Monday Doc or columns |
| AUDIENCE/REGION: | Audience or region | Column Region; keep label prefix, append value |
| SEGMENT: ALL | Funnel/segment | Column Funnel; e.g. "SEGMENT: TOF" |
| FORMATS: | Ad formats | Monday Doc or columns |
| VARIANTS: 4 | Variant count | Monday Doc or infer from variants |
| Product: | Product name | Monday Doc or columns |
| Visual | Visual / messaging notes | Monday Doc — **value must be content-only (no "Visual:" prefix)** |
| Copy info: | Copy instructions | Monday Doc — **value must be content-only (no "Copy info:" prefix)** |
| Note: - | General note | Monday Doc or free text |
| Note: \n- | Note in variant block | Per-variant note |
| Test: - | Test note | Free text |

### Briefing column variant blocks (Monday input → designers)

**Monday variant table data** (Variant, input visual + copy directions, Script) must go into the **Briefing column** variant blocks only. Each Briefing variant block is a single text node named `A - Image`, `B - Image`, `C - Image`, or `D - Image`. Put the **full multi-line block** as the value.

Format (use these exact sub-headers):
```
{A} - {type}
Input visual + copy direction: {verbatim visual-direction cell}
Script: {verbatim script cell}
```

Example value for node `A - Image`:
```
A - Video
Input visual + copy direction: Use this footage: https://...
Script: Unlock better sleep with Loop Dream
Featuring oval-shaped ear tips, designed to fit the ear's natural curve
And powerful noise reduction for all-night comfort, even whilst side sleeping
Wake up refreshed, over and over again, with Loop Dream
```

- **Do NOT** put Monday variant table input into the Copy column. The Copy column Variation frames are for **in-design copy** (final headline/subline/CTA/Note) only.
- Only fill Copy column `headline:`, `subline:`, `CTA:`, `Note:` when the Monday doc has explicit "in design copy" or script content for that variation.

### Copy column Variation frames (in-design copy only)

Each "Variation A/B/C/D" frame in the **Copy** column contains: **in design copy**, **headline:**, **subline:**, **CTA:**, **Note:**. These are for final designer copy or script. Use keys like `Variation A::headline:` only when the source has explicit in-design copy for that field; otherwise omit.

### Variant type labels (Briefing column)

| Node name | Semantic role |
|-----------|---------------|
| A - Image | Variant A: full block = type + Input visual + copy direction + Script |
| B - Image | Variant B: full block |
| C - Image | Variant C: full block |
| D - Image | Variant D: full block |

Value = multi-line string as above (e.g. "A - Video\nInput visual + copy direction: ...\nScript: ...").

### Asset frames to rename

Frames named `NAME-EXP-4x5`, `NAME-EXP-9x16`, `NAME-EXP-1x1` appear in sets of four (one per variation). Rename to `{experimentName}-A-4x5`, `{experimentName}-B-4x5`, etc. Use the experiment name from Monday item `name` (e.g. `EXP-LM166.UnlockBetterSleep-Dream-Sleepa`). Produce one **frameRenames** entry per frame: oldName exact match, newName with experiment and variant letter (A/B/C/D) and size (4x5, 9x16, 1x1).

---

## Monday column schema

Columns are provided as an array of `{ id, title, text, type }`. Use `text` for display value. Common column IDs and titles:

| Column ID | Title | Use for |
|-----------|-------|---------|
| color_mks0f16k | Batch | Batch label (e.g. "March") |
| status | Status | Status text |
| dropdown_mkxm5vvg | Region | AUDIENCE/REGION: value |
| dropdown_mkxmdz0x | Funnel | SEGMENT value (e.g. TOF) |
| dropdown_mkxm7dce | Platform | Platform (Meta, etc.) |
| date_mks96g2n | Deadline final assets | Date if needed |
| link_mkrjgz63 | Link for review | URL for link field |
| color_mks0knr8 | Creative Partner | e.g. "Content Creation" |
| multiple_person_* | People columns | Names as needed |

Item `name` is always the experiment name (Name EXP, and used in frame renames).

---

## Mapping conventions

1. **Label prefix**: For nodes like "AUDIENCE/REGION:", "SEGMENT: ALL", "IDEA:", keep the label and append or replace with the value. Example: "AUDIENCE/REGION: " + "All" → "AUDIENCE/REGION: All". For "Name EXP", replace entirely with the experiment name. **Exception:** For "Visual" and "Copy info:", provide **content-only** values (no "Visual:" or "Copy info:" prefix); the label stays in its own node and the plugin writes the value into the Specs placeholder.
1b. **Audience preference**: If Monday Doc has an `Audience` section, use it for `AUDIENCE/REGION:` (multiline allowed). Only fall back to the Region dropdown when Audience section is missing.
2. **Missing data**: If no source exists for a node, omit it from textMappings (do not invent content). For frame renames, always produce renames for NAME-EXP-* using the experiment name and variant/size.
3. **Variants (strict row integrity)**:
   - Map Monday variant table rows A/B/C/D into the **matching** Briefing variant blocks (A row -> A block, B row -> B block, etc.).
   - Never move, combine, or borrow lines from another row.
   - Copy each cell verbatim, including line breaks and parenthetical notes.
   - Format block text as: type line, then `Input visual + copy direction:`, then `Script:`.
   - Do NOT put this input into the Copy column; Copy column Variation frames are for in-design copy only.
4. **Whitespace**: Preserve single spaces after colons where the template uses them (e.g. "headline: " + value).
5. **Node name exact match**: The plugin matches by `node.name`. Use the exact string from the template (e.g. "headline:", "subline:", "CTA:", "Note:").

---

## Example (minimal)

**Input (Monday item):**
- name: "EXP-LM166.UnlockBetterSleep-Dream-Sleepa"
- columns: Region "All", Funnel "TOF", Batch "March"

**Output (excerpt):**
```json
{
  "textMappings": [
    { "nodeName": "Name EXP", "value": "EXP-LM166.UnlockBetterSleep-Dream-Sleepa" },
    { "nodeName": "AUDIENCE/REGION:", "value": "AUDIENCE/REGION: All" },
    { "nodeName": "SEGMENT: ALL", "value": "SEGMENT: TOF" },
    { "nodeName": "A - Image", "value": "A - Video:\nVisual: See ref.\nCopy: Unlock better sleep with Loop Dream. Featuring oval-shaped ear tips." }
  ],
  "frameRenames": [
    { "oldName": "NAME-EXP-4x5", "newName": "EXP-LM166.UnlockBetterSleep-Dream-Sleepa-A-4x5" },
    { "oldName": "NAME-EXP-9x16", "newName": "EXP-LM166.UnlockBetterSleep-Dream-Sleepa-A-9x16" }
  ]
}
```

(Include all NAME-EXP-* frame renames for A, B, C, D and 4x5, 9x16, 1x1 as applicable.)

---

## Fallback rules

- If Monday Doc content is not provided, map only from item name and column values. Leave IDEA, WHY, Product, Visual, Copy info, and per-variant copy unmapped (omit from textMappings).
- If a column is empty or missing, omit that node from textMappings.
- Always output frameRenames for every NAME-EXP-* frame in the template tree so the plugin can rename them.
