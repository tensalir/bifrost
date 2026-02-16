# Heimdall Architecture

Heimdall is the connector between Monday.com, Figma, and reviewer-facing
feedback surfaces. Named after the Norse guardian of the Bifrost bridge.

## Route Architecture

```
/                   → Redirects to /admin
/admin/*            → Admin dashboard (Basic Auth via ADMIN_PASSWORD)
/sheets/*           → Comment sheets (cookie auth via SHEETS_PASSWORD)
/sheets/login       → Password gate for sheets
/api/*              → Shared API layer (CORS enabled, no page auth)
```

## Capability Namespaces

| Namespace    | Audience     | Auth              | Purpose                                 |
|-------------|-------------|-------------------|-----------------------------------------|
| `/admin`    | Internal    | Basic Auth        | Operational dashboard, job queue, config|
| `/sheets`   | Reviewers   | Cookie / password | Shareable feedback artifacts            |
| `/api`      | Machines    | CORS only         | Plugin, dashboard, and automation APIs  |

### Rules

- A route belongs to exactly one capability namespace.
- If a feature needs both admin and reviewer UX, create pages in both
  groups and share backend APIs.
- Sheet URLs are permanent once shared. Never rename; add redirects.
- Admin auth and reviewer auth are independent by design.

## Adding a New Feature

1. **Audience**: Who uses it? (`admin`, `reviewer`, `plugin`, `automation`)
2. **Shareable URL?**: If yes → `/sheets/*`. If no → `/admin/*`.
3. **API**: Create endpoints under `/api/<domain>/*`.
4. **Domain logic**: Place in `src/domain/<feature>/`.
5. **Integration**: External provider clients go in `src/integrations/`.
6. **Contracts**: Shared DTOs live in `src/contracts/`.

### Module Pattern

```
feature: <name>
  app/admin/<name>/*          # internal controls
  app/sheets/<name>/*         # external reviewer UX (if applicable)
  app/api/<name>/*            # API transport
  src/domain/<name>/*         # domain logic and schemas
  src/contracts/              # shared typed contracts
  src/integrations/*          # external provider clients
```

## Key Integrations

| Service       | Purpose                        | Config                   |
|--------------|--------------------------------|--------------------------|
| Monday.com   | Briefing source, webhooks      | `MONDAY_API_TOKEN`       |
| Figma        | Template sync, comment reading | `FIGMA_ACCESS_TOKEN`     |
| Supabase     | Comment cache, summaries       | `SUPABASE_URL`           |
| Vercel KV    | Job queue, operational state   | `KV_REST_API_URL`        |
| Anthropic    | AI node mapping, summaries     | `ANTHROPIC_API_KEY`      |

## Figma Plugin

Lives in `figma-plugin/`. Communicates exclusively via `/api/*` routes.
No changes needed to plugin when admin/sheets routes change.

## Cross-Repo Standards (Babylon + Heimdall)

- Shared shadcn component baseline (Button, Card, Badge, Input, etc.)
- Shared token contract (semantic colors, spacing, radii)
- `components.json` for consistent shadcn CLI usage
- Claude frontend-design skill for quality guardrails
