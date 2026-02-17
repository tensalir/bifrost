# Sheet UI Patterns (Heimdall)

Reference for building reviewer-facing sheet UIs so composition stays consistent across Figma Comments, Stakeholder Feedback, and Briefing Assistant.

## Layout: Top bar + Left panel + Main table

All sheet types use the same structural pattern:

1. **Header (top bar)**  
   One persistent row: back link, title/context, primary actions (e.g. Run split, Import, Sync, Send). Optional inline filters (batch, assets, round selector). Use `border-b border-border bg-card/80 backdrop-blur-sm` and `px-5 py-3.5`.

2. **Left collapsible panel**  
   Context or working-doc panel. Width ~380px when open; collapse to a narrow toggle strip. Use:
   - Container: `flex-shrink-0 border-r border-primary/20 bg-primary/[0.03] transition-all duration-300`
   - Open: `w-[380px]`; closed: `w-0 overflow-hidden border-r-0`
   - Toggle button: 5px strip with ChevronLeft/ChevronRight, `border-r border-border/30`

3. **Main content**  
   Table or list in a flex-1 area with `min-w-0` to avoid overflow. Use `flex flex-col flex-1 min-w-0` for the wrapper; table/list scrolls inside.

4. **Footer (optional)**  
   One line: counts or “Powered by Heimdall”. Use `border-t border-border/50 px-5 py-2 bg-card/20` and `text-[11px] text-muted-foreground/60`.

## Component mapping

| Pattern        | CommentSheet              | StakeholderSheet           | BriefingAssistantSheet      |
|---------------|---------------------------|----------------------------|-----------------------------|
| Header        | CommentHeader             | StakeholderHeader          | Inline header + Run split   |
| Left panel    | LayerPreviewPanel         | StakeholderPreviewPanel    | BriefingWorkingDocPanel     |
| Main content  | CommentTable              | StakeholderTable           | BriefingAssignmentsTable    |
| Bottom tabs   | Page tabs                 | Round tabs                 | (none)                      |

## Panel header strip

Use a consistent strip for the left panel title:

```tsx
<div
  className="px-5 border-y border-primary/20 flex items-center flex-shrink-0"
  style={{ height: 38 }}
>
  <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/70 leading-none">
    Panel Title
  </span>
</div>
```

## Empty and loading states

- **Empty**: Centered message + primary CTA. No table skeleton.
- **Loading**: Single spinner or skeleton in the main area; avoid multiple spinners.
- **Error**: Inline under header with `text-destructive`; include retry when relevant.

## References in codebase

- `components/comments/CommentSheet.tsx` — full layout with LayerPreviewPanel and CommentTable.
- `components/sheets/StakeholderSheet.tsx` — round selector, StakeholderPreviewPanel, StakeholderTable.
- `components/sheets/BriefingAssistantSheet.tsx` — filters, BriefingWorkingDocPanel, BriefingAssignmentsTable.
- `docs/sheets/design-principles.md` — hierarchy, tabs, column behavior, a11y.
