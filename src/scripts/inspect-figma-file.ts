/**
 * Inspect Figma file: list all pages.
 * Run: npx tsx src/scripts/inspect-figma-file.ts
 */
import 'dotenv/config'

const FIGMA_API_BASE = 'https://api.figma.com/v1'
const FILE_KEY = 'lLZ2lCmGcYTNJMxLV5EitY'

async function main() {
  const token = process.env.FIGMA_ACCESS_TOKEN
  if (!token) throw new Error('FIGMA_ACCESS_TOKEN not set')

  const res = await fetch(`${FIGMA_API_BASE}/files/${FILE_KEY}?depth=1`, {
    headers: { 'X-Figma-Token': token },
  })
  if (!res.ok) throw new Error(`Figma API error: ${res.status} ${res.statusText}`)
  const data = (await res.json()) as {
    name: string
    document: { children: Array<{ id: string; name: string; type: string }> }
  }

  console.log(`File: ${data.name}`)
  console.log(`Pages (${data.document.children.length}):`)
  for (let i = 0; i < data.document.children.length; i++) {
    const page = data.document.children[i]
    console.log(`  [${i}] ${page.id} - "${page.name}" (${page.type})`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
