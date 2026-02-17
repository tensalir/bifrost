/**
 * Figma REST provider adapter. Wraps the raw REST client.
 */

import {
  getFile,
  getTeamProjects,
  getProjectFiles,
  hasFigmaReadAccess,
} from '../figma/restClient.js'
import type { FigmaProvider, FigmaFileMeta, FigmaProject, FigmaProjectFile } from './types.js'

export const figmaProvider: FigmaProvider = {
  getFile(
    fileKey: string,
    options?: { depth?: number; ids?: string[] }
  ): Promise<FigmaFileMeta | null> {
    return getFile(fileKey, options)
  },
  getTeamProjects(teamId: string): Promise<FigmaProject[]> {
    return getTeamProjects(teamId)
  },
  getProjectFiles(projectId: string): Promise<FigmaProjectFile[]> {
    return getProjectFiles(projectId)
  },
  hasReadAccess(): boolean {
    return hasFigmaReadAccess()
  },
}
