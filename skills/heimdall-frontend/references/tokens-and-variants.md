# Tokens and Variants (Heimdall)

Use design tokens and shadcn-style variants so UI stays consistent and themable.

## Token source

- **File**: `app/tokens.css`
- **Usage**: Tokens are CSS custom properties. All color tokens use HSL channel values **without** the `hsl()` wrapper so you can do: `hsl(var(--primary) / 0.5)`.

## Color tokens (semantic)

| Token               | Use for                          |
|--------------------|-----------------------------------|
| `--background`     | Main app/sheet background         |
| `--foreground`     | Primary text                      |
| `--card`           | Card/panel surfaces               |
| `--primary`        | Brand accent, CTAs, focus ring    |
| `--primary-foreground` | Text on primary surfaces      |
| `--muted`          | Subtle backgrounds                |
| `--muted-foreground` | De-emphasized text, captions   |
| `--border`         | Borders, dividers                 |
| `--destructive`    | Errors, dangerous actions         |
| `--ring`           | Focus ring (matches primary)      |

In Tailwind (via globals): `bg-background`, `text-foreground`, `bg-card`, `text-primary`, `bg-muted`, `text-muted-foreground`, `border-border`, `text-destructive`, `focus:ring-ring`.

## Panel and primary tint

For the left contextual panel use a light primary tint so it reads as “context” not “content”:

- Container: `bg-primary/[0.03]` or `bg-primary/5`
- Border: `border-primary/20`
- Strip header: `text-primary/70`
- Small info blocks inside panel: `bg-primary/[0.06] border border-primary/15`

## Radius and spacing

- **Radius**: `--radius: 0.75rem` (12px). Use `rounded-md`, `rounded-lg`, `rounded-xl` from Tailwind (they should align with the design system).
- **Spacing**: Prefer Tailwind scale (`p-4`, `gap-3`, `space-y-2`) or CSS vars `--space-*` from tokens.css.

## Button variants (shadcn)

- **Primary action**: `variant="default"` (e.g. Run split, Send to Monday).
- **Secondary**: `variant="outline"` (e.g. Sync, Import, Cancel).
- **Destructive**: `variant="destructive"` for remove/delete.
- **Ghost**: `variant="ghost"` for low-emphasis actions (e.g. collapse toggle).

## Typography

- **Font**: Space Grotesk (and optional Avantt for display). Set in tokens as `--font-sans`, `--font-display`.
- **Labels**: `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` or `text-primary/70` for panel headers.
- **Body**: `text-sm` or `text-[13px]`; secondary text `text-muted-foreground`.

## Motion

- **Transitions**: Use `transition-colors`, `transition-all duration-300` for panel open/close.
- **Loading**: `Loader2` with `animate-spin`; avoid multiple spinners on the same view.

## Checklist

- [ ] No hardcoded hex/rgb colors; use token-based classes or `hsl(var(--*))`.
- [ ] Left panel uses primary tint (`primary/5`, `primary/20`) not raw gray.
- [ ] Buttons use shadcn variants; primary = default, secondary = outline.
- [ ] Focus states use `ring` (e.g. `focus:ring-2 focus:ring-primary/30`).
