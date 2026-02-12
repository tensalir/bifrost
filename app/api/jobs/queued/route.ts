import { NextResponse } from 'next/server'
import { getAllJobs, getJobsByFileKey, getJobsByBatch } from '@/lib/kv'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fileKey = searchParams.get('fileKey') ?? searchParams.get('file_key')
    const batch = searchParams.get('batchCanonical') ?? searchParams.get('batch')
    
    const jobs = fileKey
      ? await getJobsByFileKey(fileKey)
      : batch
        ? await getJobsByBatch(batch)
        : await getAllJobs()
    
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
