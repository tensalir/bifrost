import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { runParityCheck } from '@/src/domain/forecast/parityValidator'

export const dynamic = 'force-dynamic'

/**
 * POST /api/forecast/parity-check
 * Body: multipart/form-data with file = .xlsx workbook, monthKey = e.g. May26.
 * Returns comparison report: matches and mismatches for control cells (engine vs workbook).
 */
export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const monthKey = (formData.get('monthKey') as string)?.trim()

  if (!file?.size) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (!monthKey) {
    return NextResponse.json({ error: 'monthKey required (e.g. May26)' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buf, { type: 'buffer', cellDates: true })
  } catch {
    return NextResponse.json({ error: 'Invalid Excel file' }, { status: 400 })
  }

  const report = runParityCheck(workbook, monthKey)
  return NextResponse.json({
    ok: true,
    monthKey: report.monthKey,
    matches: report.matches,
    mismatches: report.mismatches,
    total: report.total,
    summary: `${report.matches.length}/${report.total} control cells match`,
  })
}
