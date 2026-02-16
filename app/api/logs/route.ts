import { NextResponse } from 'next/server'
import { getLogs } from '@/lib/kv'
import type { LogLevel, LogCategory } from '@/lib/kv'

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
const CATEGORIES: LogCategory[] = ['webhook', 'mapping', 'queue', 'figma', 'api', 'system']

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level') as LogLevel | null
    const category = searchParams.get('category') as LogCategory | null
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200)

    if (level && !LEVELS.includes(level)) {
      return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
    }
    if (category && !CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    const logs = await getLogs({ level: level ?? undefined, category: category ?? undefined, limit })
    return NextResponse.json({ logs }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
