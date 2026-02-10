# Bifrost pilot: one monthly file

Run this on **one** board and one monthly Figma file (e.g. MARCH 2026 - PerformanceAds) to validate routing, idempotency, and plugin sync.

## Prerequisites

- Node 18+
- Monday board with a **batch** column (e.g. "MARCH 2026") and items you can move to "Figma Ready".
- Figma file named `MONTH YYYY - PerformanceAds` with a page named **"Briefing Template to Duplicate"** and text nodes that have plugin data `bifrostId` set (see [template-setup.md](./template-setup.md)).
- Optional: `BIFROST_BATCH_FILE_MAP` env set to a JSON map of canonical month key → Figma file key, e.g. `{"2026-03":"YOUR_FIGMA_FILE_KEY"}`. If omitted, the plugin matches by current file (designer opens the correct monthly file before syncing).

## 1. Verify routing (no API keys)

```bash
cd 11_Bifrost
npm install
npx tsx src/scripts/verify-routing.ts
```

- Check that "MARCH 2026" and "2026-03" resolve to canonical key `2026-03` and expected file name `MARCH 2026 - PerformanceAds`.
- Check that the second createOrQueueFigmaPage call with the same idempotency key returns `skipped` or `queued` (no duplicate job).

## 2. Start Bifrost server

```bash
export MONDAY_API_TOKEN="your_monday_token"
export MONDAY_BOARD_ID="your_board_id"   # optional, to ignore other boards
# Optional: BIFROST_BATCH_FILE_MAP='{"2026-03":"figma_file_key"}'
npm run dev
```

Server listens on `http://localhost:3846`. Register the Monday webhook URL: `https://your-host/webhooks/monday` (or use a tunnel like ngrok for localhost).

## 3. Trigger a job

- In Monday, move one experiment item to **Figma Ready** (or the status you configured). Ensure the item has **batch** set (e.g. "MARCH 2026") and a valid item name (e.g. `EXP-LM177.ChooseYourLoop-Mix-Productfocus`).
- The webhook will receive the event and **queue** a sync job (no server-side page creation in V1).

## 4. Run plugin sync in Figma

- Open the corresponding monthly Figma file (e.g. **MARCH 2026 - PerformanceAds**).
- Run the **Bifrost Sync** plugin (Development → Import plugin from manifest → select `figma-plugin/manifest.json`).
- Click **Sync queued briefings**.
- Confirm a new page is created with the experiment name and that text nodes are filled from Monday data.

## 5. Verify Monday back-updates (optional for V1.1)

- In a later iteration, Bifrost can write the new Figma page URL back to a Monday column (e.g. "Link for review"). For the pilot, you can manually paste the link from the new page.

## 6. Idempotency check

- Trigger the same Monday item again (e.g. move out of Figma Ready and back). Run the plugin again.
- Expected: no duplicate page, or the same page is updated (depending on implementation). The backend should not create a second job for the same idempotency key.

## Success criteria

- [ ] Batch "MARCH 2026" resolves to expected file name and, if mapped, file key.
- [ ] Moving item to Figma Ready queues one job.
- [ ] Plugin "Sync queued briefings" creates one new page per job and fills placeholders.
- [ ] Re-triggering the same item does not create duplicate pages (idempotency).
- [ ] Long copy in Monday expands text in Figma (HEIGHT auto-resize) without clipping (template allows growth).
