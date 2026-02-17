import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/briefing-assistant/sprints/[sprintId]
 * Returns sprint with batches and assignments.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const db = getSupabase()
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const { sprintId } = await params
  if (!sprintId) {
    return NextResponse.json({ error: 'sprintId required' }, { status: 400 })
  }

  const { data: sprint, error: sprintErr } = await db
    .from('briefing_sprints')
    .select('id, name, created_at, updated_at')
    .eq('id', sprintId)
    .single()

  if (sprintErr || !sprint) {
    return NextResponse.json({ error: 'Sprint not found' }, { status: 404 })
  }

  const { data: batches } = await db
    .from('briefing_sprint_batches')
    .select('id, batch_key, batch_label, batch_type, monday_board_id, figma_file_key')
    .eq('sprint_id', sprintId)
    .order('batch_key')

  const { data: assignments } = await db
    .from('briefing_assignments')
    .select('*')
    .eq('sprint_id', sprintId)
    .order('brief_name')

  const assignmentRows = (assignments ?? []).map((a) => {
    const row = a as {
      client_id?: string
      source?: string
      target_board_id?: string | null
      [k: string]: unknown
    }
    return {
      id: row.client_id ?? a.id,
      contentBucket: a.content_bucket,
      ideationStarter: a.ideation_starter,
      productOrUseCase: a.product_or_use_case,
      briefOwner: a.brief_owner,
      agencyRef: a.agency_ref,
      assetCount: a.asset_count,
      format: a.format,
      funnel: a.funnel,
      campaignPartnership: a.campaign_partnership ?? undefined,
      batchKey: a.batch_key,
      briefName: a.brief_name,
      mondayItemId: a.monday_item_id ?? undefined,
      figmaPageUrl: a.figma_page_url ?? undefined,
      status: a.status,
      source: row.source ?? 'split',
      targetBoardId: row.target_board_id ?? undefined,
    }
  })

  return NextResponse.json({
    sprint: {
      id: sprint.id,
      name: sprint.name,
      created_at: sprint.created_at,
      updated_at: sprint.updated_at,
      batches: (batches ?? []).map((b) => ({
        id: b.id,
        batch_key: b.batch_key,
        batch_label: b.batch_label,
        batch_type: (b as { batch_type?: string }).batch_type ?? 'monthly',
        monday_board_id: b.monday_board_id,
        figma_file_key: b.figma_file_key,
      })),
      assignments: assignmentRows,
    },
  })
}
