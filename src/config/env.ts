/**
 * Environment and secrets contract for Heimdall.
 * MONDAY_* for webhook and API; FIGMA_* for file access; optional mapping store.
 */

import { z } from 'zod'

const envSchema = z.object({
  MONDAY_API_TOKEN: z.string().min(1).optional(),
  MONDAY_SIGNING_SECRET: z.string().min(1).optional(),
  MONDAY_BOARD_ID: z.string().optional(),
  MONDAY_STATUS_FIGMA_READY: z.string().optional(),
  /** Optional strict eligibility gate for webhook queueing. */
  MONDAY_ENFORCE_FILTERS: z.enum(['true', 'false', '1', '0', '']).optional(),
  /** CSV allowlist for status values (e.g. "ready for review,brief ready / approved"). */
  MONDAY_ALLOWED_STATUS_VALUES: z.string().optional(),
  /** CSV allowlist for assignment/team values (e.g. "studio,content creation"). */
  MONDAY_ALLOWED_TEAM_VALUES: z.string().optional(),
  FIGMA_ACCESS_TOKEN: z.string().min(1).optional(),
  FIGMA_TEMPLATE_FILE_KEY: z.string().optional(),
  /** JSON map of canonical month key (e.g. "2026-03") to Figma file key. */
  HEIMDALL_BATCH_FILE_MAP: z.string().optional(),
  /** Dry run: do not write to Figma or Monday. */
  HEIMDALL_DRY_RUN: z.enum(['true', 'false', '1', '0', '']).optional(),
  /** Claude API key for mapping agent; omit to use column-only fallback. */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Extended thinking budget for mapping agent (default 10000). */
  ANTHROPIC_THINKING_BUDGET: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | null = null

export function getEnv(): Env {
  if (cached) return cached
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.warn('[Heimdall] Env validation warnings:', parsed.error.flatten())
  }
  cached = (parsed.success ? parsed.data : {}) as Env
  return cached
}

export function isDryRun(): boolean {
  const v = getEnv().HEIMDALL_DRY_RUN
  return v === 'true' || v === '1'
}
