# @thoughtform/design-system

Shared design tokens, component primitives, and layout patterns used across
Thoughtform repositories (Heimdall, Babylon, and future projects).

## Structure

```
tokens/
  css/tokens.css   - CSS custom properties (colors, spacing, radii, motion, z-index)
  ts/theme.ts      - TypeScript theme constants derived from tokens
components/        - shadcn-compatible base components (Button, Card, Badge, etc.)
patterns/          - Reusable layout patterns (sidebar, workspace shell, etc.)
```

## Usage

From a consuming repo:

```css
/* Import tokens */
@import '@thoughtform/design-system/tokens.css';
```

```tsx
/* Import components */
import { Button, Card } from '@thoughtform/design-system/components'
```

## What belongs here vs. in a repo

**Here (shared):**
- Semantic color tokens, spacing scale, radii, motion, z-index
- Base component primitives with variant APIs
- Layout shell patterns

**In individual repos:**
- Brand accent overrides (Heimdall mint, Babylon emerald, etc.)
- Feature-specific compositions
- Page-level layouts
- Copy and content tone

## Versioning

- Follow semver: additive changes are minor, breaking changes are major
- Document all token/component changes in CHANGELOG.md
- Never remove a token or variant without a major version bump
