/**
 * Monday.com provider adapter. Wraps the raw GraphQL client.
 */

import { mondayGraphql } from '../monday/client.js'
import type { MondayProvider } from './types.js'

function getMondayToken(): string | null {
  return process.env.MONDAY_API_TOKEN ?? null
}

export const mondayProvider: MondayProvider = {
  async graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
    return mondayGraphql<T>(query, variables)
  },
  isConfigured(): boolean {
    return !!getMondayToken()
  },
}
