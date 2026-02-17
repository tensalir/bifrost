/**
 * Provider adapter interfaces for Monday, Figma, Frontify.
 * Tools depend on these ports; implementations wrap vendor clients.
 */

// Re-export contract types used by providers
import type { IntegrationError } from '../../contracts/integrations.js'

/** Result of a provider call that may fail with a typed error. */
export type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: IntegrationError }

// ---------------------------------------------------------------------------
//  Monday
// ---------------------------------------------------------------------------

/** Monday.com provider port. Wraps GraphQL and item fetch. */
export interface MondayProvider {
  /** Run a GraphQL query. Returns null if token missing or on API error. */
  graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T | null>
  /** Whether the provider is configured (token present). */
  isConfigured(): boolean
}

// ---------------------------------------------------------------------------
//  Figma (shapes match restClient for adapter reuse)
// ---------------------------------------------------------------------------

export interface FigmaFileMeta {
  name: string
  document?: { id: string; name?: string; type?: string; children?: unknown[] }
  version?: string
}

export interface FigmaProject {
  id: string
  name: string
}

export interface FigmaProjectFile {
  key: string
  name: string
  last_modified?: string
  thumbnail_url?: string
}

/** Figma REST provider port. Read-only file/project access. */
export interface FigmaProvider {
  getFile(
    fileKey: string,
    options?: { depth?: number; ids?: string[] }
  ): Promise<FigmaFileMeta | null>
  getTeamProjects(teamId: string): Promise<FigmaProject[]>
  getProjectFiles(projectId: string): Promise<FigmaProjectFile[]>
  hasReadAccess(): boolean
}

// ---------------------------------------------------------------------------
//  Frontify (placeholder)
// ---------------------------------------------------------------------------

/** Frontify provider port. Scaffolded for future asset/DAM integration. */
export interface FrontifyProvider {
  /** Placeholder: report whether provider is configured. */
  isConfigured(): boolean
  /** Placeholder: health check. Returns false until implemented. */
  healthCheck(): Promise<boolean>
}
