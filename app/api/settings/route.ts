import { NextResponse } from 'next/server'
import { getRoutingMap, setRoutingMap, getFilterSettings, setFilterSettings } from '@/lib/kv'

export async function GET() {
  try {
    const [routing, filters] = await Promise.all([getRoutingMap(), getFilterSettings()])
    return NextResponse.json({ routing, filters }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    
    if (body.routing) {
      await setRoutingMap(body.routing)
    }
    
    if (body.filters) {
      await setFilterSettings(body.filters)
    }
    
    return NextResponse.json({ ok: true, message: 'Settings updated' }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
