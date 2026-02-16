import { NextResponse } from 'next/server'
import {
  getTeamProjects,
  getProjectFiles,
  type FigmaProject,
  type FigmaProjectFile,
} from '@/src/integrations/figma/restClient'

export interface TeamWithProjects {
  id: string
  name: string
  projects: Array<{
    id: string
    name: string
    files: FigmaProjectFile[]
  }>
}

/**
 * GET /api/figma/teams
 *
 * Returns all configured Figma teams with their projects and files.
 * Reads team IDs from the FIGMA_TEAM_IDS env var (comma-separated).
 * Files include thumbnail_url for display in the project browser.
 */
export async function GET() {
  const teamIdsRaw = process.env.FIGMA_TEAM_IDS
  if (!teamIdsRaw) {
    return NextResponse.json(
      { error: 'FIGMA_TEAM_IDS not configured', teams: [] },
      { status: 200 }
    )
  }

  const teamIds = teamIdsRaw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  if (teamIds.length === 0) {
    return NextResponse.json({ teams: [] })
  }

  try {
    const teams: TeamWithProjects[] = []

    for (const teamId of teamIds) {
      let projects: FigmaProject[]
      try {
        projects = await getTeamProjects(teamId)
      } catch {
        projects = []
      }

      const projectsWithFiles = await Promise.all(
        projects.map(async (project) => {
          let files: FigmaProjectFile[]
          try {
            files = await getProjectFiles(project.id)
          } catch {
            files = []
          }
          return {
            id: project.id,
            name: project.name,
            files,
          }
        })
      )

      // We don't get the team name from the projects endpoint,
      // so we derive it from the first project call or use the ID.
      teams.push({
        id: teamId,
        name: `Team ${teamId}`,
        projects: projectsWithFiles,
      })
    }

    return NextResponse.json({ teams })
  } catch (error) {
    console.error('Failed to fetch Figma teams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team data', teams: [] },
      { status: 500 }
    )
  }
}
