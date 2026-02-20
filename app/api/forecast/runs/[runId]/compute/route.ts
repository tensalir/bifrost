import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { computeFcOutput, computeCsOutput } from '@/src/domain/forecast/parityEngine'
import type { ForecastUseCaseRow } from '@/src/domain/forecast/schema'

export const dynamic = 'force-dynamic'

/**
 * GET /api/forecast/runs/[runId]/compute?monthKey=May26
 * Returns FC and CS computed outputs for the run and month.
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
  const { searchParams } = new URL(_req.url ?? '', 'http://localhost')
  const monthKey = searchParams.get('monthKey') ?? ''

  if (!runId || !monthKey) {
    return NextResponse.json({ error: 'runId and monthKey required' }, { status: 400 })
  }

  const { data: rows, error: rowsErr } = await db
    .from('forecast_use_case_rows')
    .select('*')
    .eq('run_id', runId)
    .order('row_index', { ascending: true })

  if (rowsErr) {
    return NextResponse.json({ error: rowsErr.message }, { status: 500 })
  }

  const useCaseRows: ForecastUseCaseRow[] = (rows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    run_id: r.run_id as string,
    row_index: r.row_index as number,
    year_num: r.year_num as number | null,
    month_date: r.month_date as string | null,
    use_case: r.use_case as string,
    graph_spent: r.graph_spent as number | null,
    graph_revenue: r.graph_revenue as number | null,
    roas: r.roas as number | null,
    results_spent: r.results_spent as number | null,
    spent_pct_total: r.spent_pct_total as number | null,
    forecasted_spent: r.forecasted_spent as number | null,
    forecasted_revenue: r.forecasted_revenue as number | null,
    raw_json: r.raw_json as Record<string, unknown> | null,
    created_at: r.created_at as string,
  }))

  const fc = computeFcOutput(monthKey, useCaseRows)
  const cs = computeCsOutput(fc, {
    studioAgencyNames: ['Studio N', 'Studio L', '5pm', 'Studio N repurpose', 'Monks', 'Gain', 'Viscap', 'Loop Legends', 'Reiterations', 'Localisations', 'KH', 'Reactive', 'TOTAL'],
  })

  return NextResponse.json({ fc, cs })
}
