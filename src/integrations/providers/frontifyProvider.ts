/**
 * Frontify provider adapter. Placeholder for future DAM/asset integration.
 */

import type { FrontifyProvider } from './types.js'

export const frontifyProvider: FrontifyProvider = {
  isConfigured(): boolean {
    return !!(process.env.FRONTIFY_ACCESS_TOKEN ?? process.env.FRONTIFY_API_KEY)
  },
  async healthCheck(): Promise<boolean> {
    // Not implemented yet
    return false
  },
}
