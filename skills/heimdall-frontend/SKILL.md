---
name: heimdall-frontend
description: Frontend generation workflow for Heimdall. Combines the global frontend-design skill with Heimdall-specific constraints (shadcn components, shared tokens, route architecture).
---

# Heimdall Frontend Workflow

Use this skill when building or modifying any Heimdall UI — admin pages, sheet pages, or shared components.

## Step 1: Design Intent (from frontend-design skill)

Before coding, state:
1. **Aesthetic direction** — Heimdall uses a dark, utilitarian dashboard tone for admin, and a clean minimal sheet tone for reviewer-facing pages.
2. **Font** — Space Grotesk (already loaded via Next.js).
3. **Color** — Mint green primary (`131 100% 85%` dark mode), neutral dark surfaces. Do not change these.
4. **Motion** — Minimal. Loading spinners, hover transitions. No gratuitous animation.

## Step 2: Component Generation (shadcn-first)

1. Check `components/ui/` for existing primitives before creating custom ones.
2. Use `npx shadcn@latest add <component>` via the CLI when adding new shadcn components.
3. Compose domain components from shadcn primitives — never fork a primitive.
4. Follow CVA variant naming conventions from existing components.

## Step 3: Route Placement

Determine where the page belongs:

| Audience     | Route group  | Layout                     |
|-------------|-------------|----------------------------|
| Admin/ops   | `/admin/*`  | Sidebar nav + padded main  |
| Reviewer    | `/sheets/*` | Full-screen, no sidebar    |
| API only    | `/api/*`    | No page needed             |

## Step 4: Contract Validation

- Import shared types from `src/contracts/` for API payloads.
- Use token CSS variables (from `app/tokens.css`) — never hard-code colors.
- Follow the spacing scale from the design system tokens.

## Step 5: Quality Checklist

- [ ] Component uses shadcn primitives where applicable
- [ ] No hardcoded colors — all via CSS variables
- [ ] Responsive (works on mobile widths for sheets, desktop for admin)
- [ ] Loading and error states handled
- [ ] TypeScript strict — no `any` types
- [ ] Route placed in correct group (`/admin/*` or `/sheets/*`)
