import { NextResponse } from 'next/server'

/**
 * Image proxy endpoint for Figma plugin.
 *
 * Monday.com protected_static URLs require session cookies that the plugin iframe
 * doesn't have. This endpoint resolves the image via Monday's assets GraphQL API
 * to get a signed public S3 URL, then fetches and returns the bytes with CORS headers.
 *
 * Usage: GET /api/images/proxy?url=<encoded-image-url>
 *
 * Flow:
 *   1. Extract resource/asset ID from Monday protected_static URL
 *   2. Query Monday assets API for a public_url (signed S3 link)
 *   3. Fetch the image from the public_url
 *   4. Return bytes with CORS headers to the plugin iframe
 */

const MONDAY_API_URL = 'https://api.monday.com/v2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Allowed URL patterns to prevent open-proxy abuse
const ALLOWED_HOSTS = [
  'monday.com',
  '.monday.com',
  'monday-files.s3.amazonaws.com',
  'files-monday-com.s3.amazonaws.com',
  // Figma CDN hosts (for image fills from cross-file experiment import)
  'figma-alpha-api.s3.us-west-2.amazonaws.com',
  's3-alpha.figma.com',
  's3-alpha-sig.figma.com',
  '.figma.com',
  'figma-alpha.s3.us-west-2.amazonaws.com',
]

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(host)
    )
  } catch {
    return false
  }
}

/**
 * Extract resource/asset ID from a Monday protected_static URL.
 * Pattern: /protected_static/{accountId}/resources/{resourceId}/{filename}
 */
function extractResourceId(url: string): string | null {
  const match = /\/resources\/(\d+)\//i.exec(url)
  return match ? match[1] : null
}

/**
 * Resolve a Monday resource ID to a public S3 URL via the assets API.
 */
async function resolvePublicUrl(resourceId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'API-Version': '2025-04',
      },
      body: JSON.stringify({
        query: `query ($ids: [ID!]!) { assets(ids: $ids) { id public_url } }`,
        variables: { ids: [Number(resourceId)] },
      }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { assets?: Array<{ id: string; public_url?: string }> }
    }
    return json.data?.assets?.[0]?.public_url ?? null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing "url" query parameter' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (!isAllowedUrl(imageUrl)) {
      return NextResponse.json(
        { error: 'URL not allowed — only Monday.com image URLs are supported' },
        { status: 403, headers: CORS_HEADERS }
      )
    }

    const mondayToken = process.env.MONDAY_API_TOKEN
    let fetchUrl = imageUrl

    // For protected_static URLs, resolve to a public S3 URL via Monday assets API
    if (imageUrl.includes('/protected_static/') && mondayToken) {
      const resourceId = extractResourceId(imageUrl)
      if (resourceId) {
        const publicUrl = await resolvePublicUrl(resourceId, mondayToken)
        if (publicUrl) {
          fetchUrl = publicUrl
        }
      }
    }

    // Fetch the image (either from resolved public URL or original if already public)
    const response = await fetch(fetchUrl, {
      redirect: 'follow',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Image fetch failed: ${response.status} ${response.statusText}` },
        { status: 502, headers: CORS_HEADERS }
      )
    }

    const contentType = response.headers.get('content-type') ?? 'image/png'
    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Proxy fetch failed' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

export const dynamic = 'force-dynamic'
