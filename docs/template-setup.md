# Figma template setup for Heimdall

## Template page

- Create a page named **"Briefing Template to Duplicate"** (or "Briefing Template" / "Template") in your monthly Performance Ads file.
- This page will be cloned once per queued experiment; the clone is renamed to the experiment name (e.g. `EXP-LM177.ChooseYourLoop-Mix-Productfocus`).

## Placeholder IDs

For each text node that should be filled from Monday briefing data, set **plugin data** on that node:

- **Key:** `heimdallId` (or `placeholderId` for legacy)
- **Value:** one of the IDs below.

| Placeholder ID | Monday / briefing source |
|----------------|--------------------------|
| `heimdall:exp_name` | Experiment name (item name) |
| `heimdall:idea` | Idea / Why |
| `heimdall:audience_region` | Audience / region |
| `heimdall:segment` | Segment (e.g. TOF) |
| `heimdall:formats` | Formats (e.g. Video) |
| `heimdall:var_a_headline` | Variation A headline |
| `heimdall:var_a_subline` | Variation A subline |
| `heimdall:var_a_cta` | Variation A CTA |
| `heimdall:var_b_headline` | … same for B, C, D |
| `heimdall:var_b_subline` | |
| `heimdall:var_b_cta` | |
| `heimdall:var_c_headline` | |
| `heimdall:var_c_subline` | |
| `heimdall:var_c_cta` | |
| `heimdall:var_d_headline` | |
| `heimdall:var_d_subline` | |
| `heimdall:var_d_cta` | |

## Section divider pages (page ordering)

Monthly design files use **empty pages as section headers** to group experiments by product/use case (e.g. "BUNDLES", "SWITCH", "ENGAGED KITS"). When Heimdall creates a new experiment page, it inserts it under the correct section divider.

### How it works

1. The briefing's `sectionName` is extracted from Monday (columns: `use_case`, `product`, `product_category`, `section`, `category`).
2. If no explicit column is found, Heimdall parses the experiment name for known keywords (e.g. "Bundles" in `EXP-SB150.Q&ABundles-Bundles-Mix`).
3. The plugin scans `figma.root.children` for section divider pages (non-EXP, non-template pages) and inserts the new page just before the next section divider.
4. If no matching section is found, the page is appended at the end.

### Known sections (add more in `src/domain/briefing/mondayToBriefing.ts`)

- BUNDLES
- SWITCH
- ENGAGED KITS
- NOISE CANCELLING
- NOISE SENSITIVITY

### Adding a new section

1. Create an empty page in the Figma file with the section name (e.g. "NEW PRODUCT").
2. Add the name to `KNOWN_SECTIONS` in `src/domain/briefing/mondayToBriefing.ts`.
3. Ensure the Monday item has a matching value in its `use_case` / `product` column.

## Long text (overflow)

- By default, the plugin sets **text auto-resize** to **HEIGHT** on filled text nodes so they grow with content.
- Ensure the frame containing these text nodes uses auto-layout (or enough space) so that growing height doesn’t clip. For very long copy, consider a scrollable container or a “notes” block in the template.
