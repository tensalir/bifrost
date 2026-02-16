import { NextResponse } from 'next/server'
import { getProjectFiles } from '@/src/integrations/figma/restClient'

/**
 * GET /api/figma/projects/:projectId/files
 *
 * Returns files for a single project. Lighter than /api/figma/teams
 * when you only need sibling files for the file switcher dropdown.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  try {
    const files = await getProjectFiles(projectId)
    return NextResponse.json({ projectId, files })
  } catch (error) {
    console.error(`Failed to fetch files for project ${projectId}:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch project files', files: [] },
      { status: 500 }
    )
  }
}
