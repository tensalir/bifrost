# Briefing Assistant Rollout and Validation

New Briefing Assistant lives at `/sheets/briefing-assistant` and uses APIs under `/api/briefing-assistant/`. This doc describes staged rollout and parity checks.

## Non-breaking acceptance checklist (before merge)

Verify these existing flows still work:

- [ ] **`/sheets`** — Overview page loads with both Figma Comments and Stakeholder tabs; Briefing Assistant card appears under Stakeholder tab.
- [ ] **`/sheets/stakeholder`** — Imports Excel, renders rounds, generates summaries, sends to Monday.
- [ ] **`/sheets/project/[projectId]`** — File grid and comment sheet flow unchanged.
- [ ] **Monday webhook pipeline** — Webhook received, item fetched, briefing mapped, job queued.
- [ ] **Figma plugin sync** — Pending jobs picked up and pages created correctly.
- [ ] **`/admin`** — Panel, connections, logs all functional.
- [ ] **TypeScript** — No new errors in existing files (`npm run build` and `tsc` pass).
- [ ] **API contracts** — No changes to existing API route signatures or response shapes (only new routes under `briefing-assistant`).

## Staged rollout (plan)

1. **Ship** — Deploy with new `sheets/briefing-assistant` and `api/briefing-assistant/*` behind existing auth/routes.
2. **Shadow** — Run new flow in parallel with current briefing-assistant outputs where applicable.
3. **Validate** — Confirm:
   - Split totals reconcile with expected monthly targets (e.g. January 210 assets / 53 briefs).
   - Generated angles can cite source snippets (evidence adapters).
   - Approved briefs create/attach proper Monday docs via `send-to-monday`.
   - Key fields survive Monday → Heimdall → Figma handoff (BriefingDTO compatibility).
   - Sheet interactions stay consistent with existing reviewer flows.
4. **Deprecate** — Once parity is validated, retire the legacy canvas-first path in the **old repo** (outside Heimdall).

## New routes and APIs (additive only)

| Route | Purpose |
|-------|---------|
| `GET /sheets/briefing-assistant` | Briefing Assistant sheet UI |
| `POST /api/briefing-assistant/split` | Run split engine (batchKey, totalAssets, maxBriefs) |
| `POST /api/briefing-assistant/angles` | Get angles for an assignment (evidence-based stub) |
| `POST /api/briefing-assistant/approve` | Validate working doc state |
| `POST /api/briefing-assistant/send-to-monday` | Create item/doc, queue Figma sync |

No existing route signatures or response shapes were changed.
