/**
 * Smoke tests for image proxy API.
 * Run with: npx tsx app/api/images/proxy/route.test.ts
 *
 * Validates error responses (missing param, url not allowed) without hitting Monday.
 */

import { GET } from './route.js'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

async function runTests() {
  // Missing param -> 400
  const res400 = await GET(new Request('http://localhost:3000/api/images/proxy'))
  assert(res400.status === 400, `Expected 400, got ${res400.status}`)
  const json400 = await res400.json()
  assert(json400.reason === 'missing_param', `Expected reason missing_param, got ${json400.reason}`)
  console.log('Missing param: 400 OK')

  // URL not allowed -> 403
  const res403 = await GET(
    new Request('http://localhost:3000/api/images/proxy?url=' + encodeURIComponent('https://evil.com/image.png'))
  )
  assert(res403.status === 403, `Expected 403, got ${res403.status}`)
  assert((await res403.json()).reason === 'url_not_allowed', 'Expected url_not_allowed')
  console.log('URL not allowed: 403 OK')

  // OPTIONS
  const { OPTIONS } = await import('./route.js')
  const opt = await OPTIONS()
  assert(opt.status === 204, `Expected 204, got ${opt.status}`)
  console.log('OPTIONS: 204 OK')
}

runTests()
  .then(() => console.log('\nProxy route tests: all passed'))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
