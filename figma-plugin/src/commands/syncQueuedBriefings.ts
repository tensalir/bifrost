/**
 * Sync queued briefings: fetch jobs for current file, duplicate template page, fill, report.
 * Runs in Figma plugin context; no Node/backend imports.
 */

const BIFROST_API = 'http://localhost:3846'

interface QueuedJob {
  id: string
  idempotencyKey: string
  experimentPageName: string
  briefingPayload: BriefingPayload
  figmaFileKey: string | null
  expectedFileName: string
}

interface BriefingPayload {
  experimentName?: string
  idea?: string
  audienceRegion?: string
  segment?: string
  formats?: string
  variants?: Array<{
    id?: string
    headline?: string
    subline?: string
    cta?: string
    product?: string
    valueProp?: string
  }>
}

const TEMPLATE_PAGE_NAMES = ['Briefing Template to Duplicate', 'Briefing Template', 'Template']

function getPlaceholderValue(placeholderId: string, briefing: BriefingPayload): string {
  const v = briefing.variants ?? []
  const map: Record<string, string> = {
    'bifrost:exp_name': briefing.experimentName ?? '',
    'bifrost:idea': briefing.idea ?? '',
    'bifrost:audience_region': briefing.audienceRegion ?? '',
    'bifrost:segment': briefing.segment ?? '',
    'bifrost:formats': briefing.formats ?? '',
    'bifrost:var_a_headline': v[0]?.headline ?? '',
    'bifrost:var_a_subline': v[0]?.subline ?? '',
    'bifrost:var_a_cta': v[0]?.cta ?? '',
    'bifrost:var_b_headline': v[1]?.headline ?? '',
    'bifrost:var_b_subline': v[1]?.subline ?? '',
    'bifrost:var_b_cta': v[1]?.cta ?? '',
    'bifrost:var_c_headline': v[2]?.headline ?? '',
    'bifrost:var_c_subline': v[2]?.subline ?? '',
    'bifrost:var_c_cta': v[2]?.cta ?? '',
    'bifrost:var_d_headline': v[3]?.headline ?? '',
    'bifrost:var_d_subline': v[3]?.subline ?? '',
    'bifrost:var_d_cta': v[3]?.cta ?? '',
  }
  return map[placeholderId] ?? ''
}

function fillTextNodes(node: SceneNode, briefing: BriefingPayload): void {
  if (node.type === 'TEXT') {
    const textNode = node as TextNode
    const bifrostId = textNode.getPluginData?.('bifrostId') || textNode.getPluginData?.('placeholderId')
    if (bifrostId) {
      const value = getPlaceholderValue(bifrostId, briefing)
      try {
        textNode.characters = value
        textNode.textAutoResize = 'HEIGHT'
      } catch (_) {
        // read-only or font
      }
    }
    return
  }
  if ('children' in node && node.children) {
    for (const child of node.children) {
      fillTextNodes(child, briefing)
    }
  }
}

async function findTemplatePage(): Promise<PageNode | null> {
  const root = figma.root
  await root.loadAsync?.()
  const children = root.children ?? []
  for (const node of children) {
    if (node.type !== 'PAGE') continue
    const name = (node as PageNode).name
    if (TEMPLATE_PAGE_NAMES.some((t) => name.includes(t) || name === t)) {
      return node as PageNode
    }
  }
  return null
}

export async function runSyncQueuedBriefings(): Promise<{ done: number; failed: string[] }> {
  const fileKey = figma.fileKey
  if (!fileKey) {
    throw new Error('No file key (save the file first or open from cloud).')
  }

  const res = await fetch(`${BIFROST_API}/api/jobs/queued?fileKey=${encodeURIComponent(fileKey)}`)
  if (!res.ok) {
    throw new Error(`Bifrost API error: ${res.status}`)
  }
  const data = (await res.json()) as { jobs?: QueuedJob[] }
  const jobs = data.jobs ?? []
  if (jobs.length === 0) {
    return { done: 0, failed: [] }
  }

  const templatePage = await findTemplatePage()
  if (!templatePage) {
    throw new Error(
      `No template page found. Add a page named one of: ${TEMPLATE_PAGE_NAMES.join(', ')}`
    )
  }

  const failed: string[] = []
  let done = 0

  for (const job of jobs) {
    try {
      const cloned = templatePage.clone()
      cloned.name = job.experimentPageName
      cloned.setPluginData('bifrostIdempotencyKey', job.idempotencyKey)
      cloned.setPluginData('bifrostMondayItemId', (job as unknown as { mondayItemId?: string }).mondayItemId ?? '')
      fillTextNodes(cloned, job.briefingPayload as BriefingPayload)
      const pageId = cloned.id
      const fileUrl = `https://www.figma.com/file/${fileKey}?node-id=${encodeURIComponent(pageId.replace(':', '-'))}`

      const completeRes = await fetch(`${BIFROST_API}/api/jobs/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: job.idempotencyKey,
          figmaPageId: pageId,
          figmaFileUrl: fileUrl,
        }),
      })
      if (!completeRes.ok) {
        failed.push(job.experimentPageName)
        continue
      }
      done++
    } catch (e) {
      failed.push(job.experimentPageName)
      try {
        await fetch(`${BIFROST_API}/api/jobs/fail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey: job.idempotencyKey,
            errorCode: e instanceof Error ? e.message : 'Unknown',
          }),
        })
      } catch (_) {
        // ignore
      }
    }
  }

  return { done, failed }
}
