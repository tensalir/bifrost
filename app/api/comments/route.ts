import { NextRequest, NextResponse } from 'next/server'
import {
  getConsolidatedComments,
  getFileComments,
  hasFigmaReadAccess,
  type ConsolidatedComment,
  type FigmaComment,
} from '@/src/integrations/figma/restClient'

export const dynamic = 'force-dynamic'

/**
 * GET /api/comments?fileKey=...&format=json|csv&raw=true
 *
 * Fetch comments from a Figma file and return them in consolidated
 * or raw format. Supports JSON and CSV output.
 *
 * Query params:
 *   fileKey  - (required) Figma file key
 *   format   - "json" (default) or "csv"
 *   raw      - "true" to return raw Figma API response instead of consolidated
 *   status   - "open", "resolved", or "all" (default: "all")
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fileKey = searchParams.get('fileKey')
  const format = searchParams.get('format') ?? 'json'
  const raw = searchParams.get('raw') === 'true'
  const statusFilter = searchParams.get('status') ?? 'all'

  if (!fileKey) {
    return NextResponse.json(
      { error: 'Missing required query param: fileKey' },
      { status: 400 }
    )
  }

  if (!hasFigmaReadAccess()) {
    return NextResponse.json(
      { error: 'No FIGMA_ACCESS_TOKEN configured on the server' },
      { status: 503 }
    )
  }

  try {
    if (raw) {
      const comments = await getFileComments(fileKey, { asMarkdown: true })
      if (format === 'csv') {
        return csvResponse(rawToCsvRows(comments), 'comments-raw')
      }
      return NextResponse.json({ fileKey, count: comments.length, comments })
    }

    let comments = await getConsolidatedComments(fileKey, { asMarkdown: true })

    if (statusFilter === 'open') {
      comments = comments.filter((c) => c.status === 'open')
    } else if (statusFilter === 'resolved') {
      comments = comments.filter((c) => c.status === 'resolved')
    }

    if (format === 'csv') {
      return csvResponse(consolidatedToCsvRows(comments), 'comments')
    }

    return NextResponse.json({
      fileKey,
      count: comments.length,
      topLevel: comments.filter((c) => c.threadDepth === 0).length,
      replies: comments.filter((c) => c.threadDepth > 0).length,
      open: comments.filter((c) => c.status === 'open').length,
      resolved: comments.filter((c) => c.status === 'resolved').length,
      comments,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function consolidatedToCsvRows(comments: ConsolidatedComment[]): string {
  const headers = [
    '#',
    'Author',
    'Message',
    'Created',
    'Resolved',
    'Status',
    'Thread Depth',
    'Reply Count',
    'Node ID',
  ]
  const rows = comments.map((c) => [
    String(c.orderNumber ?? ''),
    escapeCsv(c.author),
    escapeCsv(c.message),
    c.createdAt,
    c.resolvedAt ?? '',
    c.status,
    String(c.threadDepth),
    String(c.replyCount),
    c.nodeId ?? '',
  ])
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

function rawToCsvRows(comments: FigmaComment[]): string {
  const headers = [
    'ID',
    'Order',
    'Author',
    'Message',
    'Created',
    'Resolved',
    'Parent ID',
    'Node ID',
    'File Key',
  ]
  const rows = comments.map((c) => [
    c.id,
    String(c.order_id ?? ''),
    escapeCsv(c.user.handle),
    escapeCsv(c.message),
    c.created_at,
    c.resolved_at ?? '',
    c.parent_id ?? '',
    c.client_meta?.node_id ?? '',
    c.file_key,
  ])
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

function csvResponse(csv: string, filenamePrefix: string): NextResponse {
  const timestamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filenamePrefix}-${timestamp}.csv"`,
    },
  })
}
