/**
 * Tests for Monday doc image extraction (getDocImages).
 * Run with: npx tsx src/integrations/monday/docReaderImages.test.ts
 *
 * Mocks the Monday GraphQL client to assert image block parsing for:
 * - Case A: image blocks with assetId (and optional url)
 * - Case B: image blocks with publicUrl only
 * - Nested content shapes (content.data, content.image, etc.)
 */

import { getDocImages } from './docReader.js'

const MONDAY_API_URL = 'https://api.monday.com/v2'
const originalFetch = globalThis.fetch

// So mondayGraphql runs (it skips if token missing)
if (!process.env.MONDAY_API_TOKEN) process.env.MONDAY_API_TOKEN = 'test-token'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

// Mock fetch to return controlled doc blocks
function mockGraphql(blocks: Array<{ id: string; type: string; content: unknown }>) {
  ;(globalThis as any).fetch = async (url: string, init: RequestInit) => {
    if (url !== MONDAY_API_URL || init?.method !== 'POST') {
      return originalFetch(url, init as RequestInit)
    }
    const body = JSON.parse((init.body as string) || '{}')
    const variables = body.variables || {}
    const page = variables.page ?? 1
    const limit = variables.limit ?? 100
    const start = (page - 1) * limit
    const chunk = blocks.slice(start, start + limit)
    return new Response(
      JSON.stringify({
        data: {
          docs: [
            {
              id: 'doc-1',
              blocks: chunk,
            },
          ],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

function restoreFetch() {
  globalThis.fetch = originalFetch
}

async function runTests() {
  // Case A: image block with assetId and url (Monday asset)
  mockGraphql([
    {
      id: 'block-1',
      type: 'image',
      content: {
        url: 'https://monday.com/resources/12345/image.png',
        assetId: 12345,
        width: 900,
        alignment: 'center',
      },
    },
  ])
  const imagesA = await getDocImages('18400460675')
  restoreFetch()
  assert(imagesA.length === 1, `Case A: expected 1 image, got ${imagesA.length}`)
  assert(imagesA[0].assetId === '12345', `Case A: expected assetId 12345, got ${imagesA[0].assetId}`)
  assert(!!imagesA[0].url, 'Case A: expected url')
  assert(imagesA[0].source === 'doc', 'Case A: source doc')
  console.log('Case A (assetId + url): OK', imagesA[0])

  // Case B: image block with publicUrl only (public URL image)
  mockGraphql([
    {
      id: 'block-2',
      type: 'image',
      content: {
        width: 123,
        publicUrl: 'https://www.test.com/static/download/testimage.png',
        direction: 'rtl',
        alignment: 'right',
      },
    },
  ])
  const imagesB = await getDocImages('999')
  restoreFetch()
  assert(imagesB.length === 1, `Case B: expected 1 image, got ${imagesB.length}`)
  assert(
    imagesB[0].url === 'https://www.test.com/static/download/testimage.png',
    `Case B: wrong url ${imagesB[0].url}`
  )
  console.log('Case B (publicUrl only): OK', imagesB[0])

  // Nested content: content.image.src
  mockGraphql([
    {
      id: 'block-3',
      type: 'image',
      content: {
        data: {
          image: {
            src: 'https://nested.example.com/photo.jpg',
            assetId: 67890,
          },
        },
      },
    },
  ])
  const imagesC = await getDocImages('888')
  restoreFetch()
  assert(imagesC.length === 1, `Nested: expected 1 image, got ${imagesC.length}`)
  assert(
    imagesC[0].url === 'https://nested.example.com/photo.jpg',
    `Nested: wrong url ${imagesC[0].url}`
  )
  assert(imagesC[0].assetId === '67890', `Nested: expected assetId, got ${imagesC[0].assetId}`)
  console.log('Nested content (data.image): OK', imagesC[0])

  // rawUrl variant
  mockGraphql([
    {
      id: 'block-4',
      type: 'file',
      content: { rawUrl: 'https://files.example.com/doc.pdf', name: 'doc.pdf' },
    },
  ])
  const imagesD = await getDocImages('777')
  restoreFetch()
  assert(imagesD.length === 1, `rawUrl: expected 1 entry, got ${imagesD.length}`)
  assert(imagesD[0].url === 'https://files.example.com/doc.pdf', 'rawUrl: wrong url')
  console.log('rawUrl + file type: OK', imagesD[0])

  // Empty doc
  mockGraphql([])
  const imagesE = await getDocImages('666')
  restoreFetch()
  assert(imagesE.length === 0, `Empty: expected 0 images, got ${imagesE.length}`)
  console.log('Empty doc: OK')

  // Invalid doc id
  const imagesF = await getDocImages('')
  assert(imagesF.length === 0, 'Empty docId: expected 0')
  const imagesG = await getDocImages('abc')
  assert(imagesG.length === 0, 'Non-numeric docId: expected 0')
  console.log('Invalid doc id: OK')
}

runTests()
  .then(() => {
    console.log('\nDoc image extraction tests: all passed')
  })
  .catch((err) => {
    restoreFetch()
    console.error(err)
    process.exit(1)
  })
