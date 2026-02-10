# Bifrost

Monday → Figma experiment page automation. When a Monday item is moved to **Figma Ready**, Bifrost queues a sync job; opening the matching monthly Figma file and running the **Bifrost Sync** plugin creates a new page from the briefing template and fills it from Monday data.

## Quick start

1. **Backend** (webhook + job API)
   ```bash
   npm install
   cp .env.example .env   # set MONDAY_API_TOKEN, optional FIGMA_ACCESS_TOKEN, BIFROST_BATCH_FILE_MAP
   npm run dev
   ```
   Server: `http://localhost:3846`. Register `POST /webhooks/monday` with Monday.

2. **Figma plugin**
   - Build: `cd figma-plugin && npm install && npm run build`
   - In Figma: Plugins → Development → Import plugin from manifest → select `figma-plugin/manifest.json`
   - Open your monthly file (e.g. *MARCH 2026 - PerformanceAds*), run the plugin, click **Sync queued briefings**.

3. **Template**
   - One page in the file named **"Briefing Template to Duplicate"** (or "Briefing Template").
   - On each text node to fill, set plugin data **bifrostId** to a placeholder (e.g. `bifrost:exp_name`, `bifrost:var_a_headline`). See [docs/template-setup.md](docs/template-setup.md).

## Routing

- Monday **batch** column (e.g. "MARCH 2026") → canonical key `2026-03` → expected Figma file name **MARCH 2026 - PerformanceAds**.
- Optional env `BIFROST_BATCH_FILE_MAP` (JSON): map canonical key to Figma file key so the plugin can target the right file when multiple are open.

## Verify

```bash
npx tsx src/scripts/verify-routing.ts
```

## Pilot

See [docs/pilot.md](docs/pilot.md) for a step-by-step pilot on one monthly file and board.

## Layout

- `src/` – backend: config, domain (routing, briefing, template), integrations (Monday, Figma REST), jobs (queue), orchestration (createOrQueue, resolveFigmaTarget), API (server, webhooks).
- `figma-plugin/` – plugin: `code.ts` → `code.js`, UI inline; syncs queued jobs and fills template by placeholder IDs.
- `docs/` – template setup and pilot runbook.
