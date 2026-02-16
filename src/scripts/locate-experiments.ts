/**
 * Locate experiments by name across Figma Performance Ads project files.
 * Run without server: npx tsx src/scripts/locate-experiments.ts "EXP-JU38..." "EXP-GAIN13..."
 * Or from file: npx tsx src/scripts/locate-experiments.ts --file experiments.txt
 * Output: table or JSON (--json).
 */
import 'dotenv/config'
import { getProjectFiles, getFile } from '../integrations/figma/restClient.js'

const DEFAULT_PROJECT_ID = '387033831'
const RATE_LIMIT_DELAY_MS = 500

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function extractExperimentId(name: string): string | null {
  const m = name.match(/^(E?EXP[-.]?[A-Z0-9]+)/i)
  return m ? m[1].toUpperCase() : null
}

function levenshtein(a: string, b: string): number {
  const an = a.length
  const bn = b.length
  const dp: number[][] = Array(an + 1)
  for (let i = 0; i <= an; i++) dp[i] = Array(bn + 1).fill(0)
  for (let i = 0; i <= an; i++) dp[i]![0] = i
  for (let j = 0; j <= bn; j++) dp[0]![j] = j
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost
      )
    }
  }
  return dp[an]![bn]!
}

interface PageInfo {
  fileKey: string
  fileName: string
  pageId: string
  pageName: string
}

interface LocateResult {
  experimentName: string
  found: boolean
  fileKey: string | null
  fileName: string | null
  pageId: string | null
  pageName: string | null
  figmaUrl: string | null
  matchType?: 'exact' | 'id_prefix' | 'fuzzy'
}

function buildFigmaPageUrl(fileKey: string, pageId: string): string {
  const nodeId = pageId.replace(':', '-')
  return `https://www.figma.com/design/${fileKey}/?node-id=${nodeId}`
}

async function locateExperiments(
  experimentNames: string[],
  projectId: string
): Promise<LocateResult[]> {
  const files = await getProjectFiles(projectId)
  if (files.length === 0) {
    return experimentNames.map((name) => ({
      experimentName: name,
      found: false,
      fileKey: null,
      fileName: null,
      pageId: null,
      pageName: null,
      figmaUrl: null,
    }))
  }

  const allPages: PageInfo[] = []
  for (const f of files) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS))
    const meta = await getFile(f.key, { depth: 1 })
    if (!meta?.document || !('children' in meta.document)) continue
    const children = (meta.document as { children?: Array<{ id: string; name?: string }> }).children
    if (!Array.isArray(children)) continue
    for (const page of children) {
      const pageName = page?.name ?? ''
      if (!page?.id) continue
      allPages.push({
        fileKey: f.key,
        fileName: f.name,
        pageId: page.id,
        pageName,
      })
    }
  }

  return experimentNames.map((experimentName) => {
    const norm = normalize(experimentName)
    const expId = extractExperimentId(experimentName)

    let best: PageInfo | undefined
    let matchType: 'exact' | 'id_prefix' | 'fuzzy' | undefined

    best = allPages.find((p) => normalize(p.pageName) === norm)
    if (best) matchType = 'exact'

    if (!best && expId) {
      const idNorm = expId.replace(/[-.]/g, '')
      const candidates = allPages.filter((p) => {
        const pageNorm = normalize(p.pageName).replace(/[-.\s]/g, '')
        return pageNorm.includes(idNorm) || idNorm.includes(pageNorm.slice(0, 10))
      })
      if (candidates.length === 1) {
        best = candidates[0]
        matchType = 'id_prefix'
      } else if (candidates.length > 1) {
        const exactId = allPages.find((p) => normalize(p.pageName).startsWith(norm.slice(0, 15)))
        best = exactId ?? candidates[0]
        matchType = 'id_prefix'
      }
    }

    if (!best) {
      let minDist = 4
      for (const p of allPages) {
        const d = levenshtein(norm, normalize(p.pageName))
        if (d < minDist) {
          minDist = d
          best = p
          matchType = 'fuzzy'
        }
      }
    }

    if (!best) {
      return {
        experimentName,
        found: false,
        fileKey: null,
        fileName: null,
        pageId: null,
        pageName: null,
        figmaUrl: null,
      }
    }

    return {
      experimentName,
      found: true,
      fileKey: best.fileKey,
      fileName: best.fileName,
      pageId: best.pageId,
      pageName: best.pageName,
      figmaUrl: buildFigmaPageUrl(best.fileKey, best.pageId),
      matchType,
    }
  })
}

async function main() {
  const token = process.env.FIGMA_ACCESS_TOKEN
  if (!token) {
    console.error('FIGMA_ACCESS_TOKEN is required (set in .env or environment)')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const jsonOut = args.includes('--json')
  const fileIdx = args.indexOf('--file')
  let experimentNames: string[]

  if (fileIdx >= 0 && args[fileIdx + 1]) {
    const fs = await import('fs')
    const path = args[fileIdx + 1]
    const content = fs.readFileSync(path, 'utf-8')
    experimentNames = content
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  } else {
    experimentNames = args.filter((a) => !a.startsWith('--'))
  }

  if (experimentNames.length === 0) {
    console.error('Usage: npx tsx src/scripts/locate-experiments.ts "EXP-NAME1" "EXP-NAME2" ...')
    console.error('   or: npx tsx src/scripts/locate-experiments.ts --file experiments.txt')
    console.error('Options: --json (output JSON)')
    process.exit(1)
  }

  const projectId = process.env.HEIMDALL_FIGMA_PROJECT_ID ?? DEFAULT_PROJECT_ID
  const results = await locateExperiments(experimentNames, projectId)

  if (jsonOut) {
    console.log(JSON.stringify({ results }, null, 2))
    return
  }

  const found = results.filter((r) => r.found).length
  console.log(`Locate results: ${found}/${results.length} found\n`)
  console.log('Experiment name                    | Status  | Source file           | Page')
  console.log('-'.repeat(90))
  for (const r of results) {
    const name = (r.experimentName.slice(0, 34) + (r.experimentName.length > 34 ? '…' : '')).padEnd(35)
    const status = r.found ? 'Found' : 'Not found'
    const file = (r.fileName ?? '-').slice(0, 21).padEnd(21)
    const page = r.pageName ?? '-'
    console.log(`${name} | ${status.padEnd(7)} | ${file} | ${page}`)
  }
  if (results.some((r) => r.found && r.figmaUrl)) {
    console.log('\nFigma links (first 3):')
    results
      .filter((r) => r.found && r.figmaUrl)
      .slice(0, 3)
      .forEach((r) => console.log(`  ${r.experimentName}: ${r.figmaUrl}`))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
