import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/forecast/runs/[runId]
 * Returns one forecast run with its use-case rows.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const db = getSupabase()
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const { runId } = await params
  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 })
  }

  const { data: run, error: runErr } = await db
    .from('forecast_runs')
    .select('id, name, uploaded_at, workbook_filename, sheet_names, month_keys, created_at')
    .eq('id', runId)
    .single()

  if (runErr || !run) {
    return NextResponse.json({ error: runErr?.message ?? 'Run not found' }, { status: 404 })
  }

  const { data: rows, error: rowsErr } = await db
    .from('forecast_use_case_rows')
    .select('*')
    .eq('run_id', runId)
    .order('row_index', { ascending: true })

  if (rowsErr) {
    return NextResponse.json({ run, useCaseRows: [] })
  }

  return NextResponse.json({ run, useCaseRows: rows ?? [] })
}
