/**
 * Heimdall Figma plugin — command router.
 * Each menu command maps to a dedicated handler in src/commands/.
 * esbuild bundles this into code.js (iife format).
 */

import { runSyncBriefings } from './src/commands/syncBriefings'
import { runExportComments } from './src/commands/exportComments'

const command = figma.command

if (command === 'sync-briefings') {
  runSyncBriefings()
} else if (command === 'export-comments') {
  runExportComments()
} else {
  // Default: show sync UI (backward compat when run without menu)
  runSyncBriefings()
}
