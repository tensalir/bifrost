import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ ok: true, service: 'bifrost' }, { status: 200 })
}

export const dynamic = 'force-dynamic'
