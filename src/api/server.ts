/**
 * Minimal HTTP server for webhooks and plugin API.
 */

import { createServer } from 'node:http'
import { getEnv } from '../config/env.js'
import { handleMondayWebhook, queueMondayItem } from './webhooks/monday.js'
import {
  getAllPendingJobs,
  getPendingJobsByFileKey,
  getPendingJobsByBatchCanonical,
  markJobCompleted,
  markJobFailed,
} from '../jobs/pendingFigmaSyncQueue.js'

async function parseJsonBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function send(res: import('node:http').ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '/'
  const method = req.method ?? 'GET'
  const [path, qs] = url.split('?')

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (path === '/health') {
    send(res, 200, { ok: true })
    return
  }

  if (path === '/webhooks/monday' && method === 'POST') {
    const body = (await parseJsonBody(req)) as Parameters<typeof handleMondayWebhook>[0]
    const result = await handleMondayWebhook(body)
    if (result.challenge != null) {
      send(res, 200, { challenge: result.challenge })
    } else {
      send(res, 200, { received: result.received, inserted: result.inserted, outcome: result.outcome, message: result.message, error: result.error })
    }
    return
  }

  if (path === '/api/jobs/queue' && method === 'POST') {
    const body = (await parseJsonBody(req)) as Record<string, unknown>
    const itemId = String(body.mondayItemId ?? body.item_id ?? '')
    const boardId = String(body.mondayBoardId ?? body.board_id ?? getEnv().MONDAY_BOARD_ID ?? '')
    if (!itemId || !boardId) {
      send(res, 400, { error: 'mondayItemId and mondayBoardId (or MONDAY_BOARD_ID) required' })
      return
    }
    try {
      const result = await queueMondayItem(boardId, itemId)
      send(res, 200, result)
    } catch (e) {
      send(res, 500, { error: String(e instanceof Error ? e.message : e) })
    }
    return
  }

  if (path === '/api/jobs/queued' && method === 'GET') {
    const params = new URLSearchParams(qs ?? '')
    const fileKey = params.get('fileKey') ?? params.get('file_key')
    const batch = params.get('batchCanonical') ?? params.get('batch')
    const jobs = fileKey
      ? getPendingJobsByFileKey(fileKey)
      : batch
        ? getPendingJobsByBatchCanonical(batch)
        : getAllPendingJobs()
    send(res, 200, { jobs })
    return
  }

  if (path === '/api/jobs/complete' && method === 'POST') {
    const body = (await parseJsonBody(req)) as {
      idempotencyKey: string
      figmaPageId: string
      figmaFileUrl?: string
    }
    const { idempotencyKey, figmaPageId, figmaFileUrl } = body
    if (!idempotencyKey || !figmaPageId) {
      send(res, 400, { error: 'idempotencyKey and figmaPageId required' })
      return
    }
    const updated = markJobCompleted(idempotencyKey, { figmaPageId, figmaFileUrl })
    send(res, 200, { ok: !!updated, job: updated })
    return
  }

  if (path === '/api/jobs/fail' && method === 'POST') {
    const body = (await parseJsonBody(req)) as { idempotencyKey: string; errorCode: string }
    const { idempotencyKey, errorCode } = body
    if (!idempotencyKey || !errorCode) {
      send(res, 400, { error: 'idempotencyKey and errorCode required' })
      return
    }
    const updated = markJobFailed(idempotencyKey, errorCode)
    send(res, 200, { ok: !!updated, job: updated })
    return
  }

  send(res, 404, { error: 'Not found' })
})

export function startServer(port?: number): void {
  const envPort = Number(process.env.PORT)
  const p = port ?? (Number.isFinite(envPort) ? envPort : 3846)
  server.listen(p, () => {
    console.log(`[Heimdall] Server listening on http://localhost:${p}`)
  })
}
