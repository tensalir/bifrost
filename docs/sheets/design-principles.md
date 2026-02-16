# Sheet UI Design Principles

Concise source of truth for reviewer-facing sheet UIs in Heimdall (Figma comments, Stakeholder Feedback, and future sheet types). Components live in `components/sheets/` and follow these patterns.

## Information hierarchy

- **Header**: One persistent row with context (title, round/file selector) and primary actions (Import, Sync, Send). Use `SheetHeader` with left/right slots.
- **Main area**: Scrollable content (table or list). No competing primary actions; secondary actions live per row/cell.
- **Tabs**: When the sheet has multiple “worksheets” (Figma pages, feedback rounds), use bottom tabs (`SheetTabs`) for navigation. Active tab is clearly indicated (border, weight).
- **Footer** (optional): Short metadata or “Powered by Heimdall”; keep minimal.

## Tab semantics

- Tabs map 1:1 to a backend concept (e.g. one round per tab, one Figma page per tab).
- Default selection: latest or first item (e.g. most recent round, first page).
- Tab label: short, readable; optional badge for counts.
- Horizontal scroll when many tabs; no wrapping.

## Column behavior

- **Width**: Use consistent column definitions (e.g. `SheetTable` colgroup or fixed min-widths) so Strategy/Design/Copy and similar columns behave the same across sheet types.
- **Overflow**: Long text in cells: truncate with `truncate` or allow expand-on-focus; avoid layout shift.
- **Edit mode**: Inline edit (e.g. feedback cells, brief link) on focus or explicit “Edit”; blur or Enter saves. Show a brief saving state when applicable.

## Interaction states

- **Empty**: Clear message and primary CTA (e.g. “Import from Excel” or “Sync from Monday”). No table skeleton.
- **Loading**: Single global spinner or skeleton for the main content area; avoid multiple spinners.
- **Saving**: Per-cell or per-row indicator (e.g. “Saving…” or spinner) so users know what’s in flight.
- **Error**: Inline error text (e.g. under header or above table); retry when relevant. Use `text-destructive` and avoid blocking the whole sheet.

## Brand and tokens

- Use design tokens from `app/tokens.css`: `--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--destructive`, `--radius`.
- Prefer semantic tokens over raw colors (e.g. `text-muted-foreground`, `bg-card`, `border-border`).
- shadcn-style variants: `variant="outline"` for secondary actions, `variant="default"` for primary; use `Button`, `Card`, and existing UI components for consistency.

## Accessibility

- **Keyboard**: All actions (tabs, buttons, links, inputs) reachable and activatable via keyboard; visible focus ring (`focus:ring-2 focus:ring-primary/30` or equivalent).
- **Focus**: After open/save dialogs close, return focus to the trigger when possible.
- **Contrast**: Text on backgrounds meets contrast requirements; use `text-foreground` and `text-muted-foreground` rather than arbitrary grays.
- **Labels**: Form controls and icon-only buttons have `aria-label` or visible text so screen readers get context.
