/**
 * Minimal HTTP server for webhooks and plugin API.
 */

import { createServer } from 'node:http'
import { handleMondayWebhook } from './webhooks/monday.js'
import {
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
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '/'
  const method = req.method ?? 'GET'
  const [path, qs] = url.split('?')

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

  if (path === '/api/jobs/queued' && method === 'GET') {
    const params = new URLSearchParams(qs ?? '')
    const fileKey = params.get('fileKey') ?? params.get('file_key')
    const batch = params.get('batchCanonical') ?? params.get('batch')
    if (!fileKey && !batch) {
      send(res, 400, { error: 'fileKey or batchCanonical required' })
      return
    }
    const jobs = fileKey
      ? getPendingJobsByFileKey(fileKey)
      : getPendingJobsByBatchCanonical(batch!)
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
  const p = port ?? Number(process.env.PORT) ?? 3846
  server.listen(p, () => {
    console.log(`[Bifrost] Server listening on http://localhost:${p}`)
  })
}
