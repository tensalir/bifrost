import { NextResponse } from 'next/server'
import { getAllJobs, getJobsByFileKey, getJobsByBatch, getJobById } from '@/lib/kv'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    const fileKey = searchParams.get('fileKey') ?? searchParams.get('file_key')
    const batch = searchParams.get('batchCanonical') ?? searchParams.get('batch')

    const allJobs = idsParam
      ? (
          await Promise.all(
            idsParam
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((id) => getJobById(id))
          )
        ).filter((j): j is NonNullable<typeof j> => j !== null)
      : fileKey
        ? await getJobsByFileKey(fileKey)
        : batch
          ? await getJobsByBatch(batch)
          : await getAllJobs()

    // Only return queued jobs — plugin should not re-process completed/failed ones
    const jobs = allJobs.filter((j) => j.state === 'queued')


    return NextResponse.json({ jobs }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export const dynamic = 'force-dynamic'
