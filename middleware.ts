/**
 * Heimdall middleware — route-based auth + CORS + legacy redirects.
 *
 * Auth zones:
 *   /admin/*   → Basic Auth with ADMIN_PASSWORD
 *   /sheets/*  → Cookie-based auth with SHEETS_PASSWORD (except /sheets/login)
 *   /api/*     → CORS headers only (Figma plugin needs open access)
 *   /          → No auth (landing redirect)
 *
 * Legacy redirects keep old URLs working during migration.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/* ------------------------------------------------------------------ */
/*  Legacy redirects — old paths → new paths                          */
/* ------------------------------------------------------------------ */

const LEGACY_REDIRECTS: Record<string, string> = {
  '/jobs': '/admin/jobs',
  '/queue': '/admin/queue',
  '/routing': '/admin/routing',
  '/logs': '/admin/logs',
  '/settings': '/admin/settings',
  '/comments': '/sheets',
}

function legacyRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl

  // Exact match redirects
  if (LEGACY_REDIRECTS[pathname]) {
    const url = request.nextUrl.clone()
    url.pathname = LEGACY_REDIRECTS[pathname]
    return NextResponse.redirect(url, 308)
  }

  // /comments/:fileKey → /sheets/:fileKey
  if (pathname.startsWith('/comments/')) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.replace('/comments/', '/sheets/')
    return NextResponse.redirect(url, 308)
  }

  return null
}

/* ------------------------------------------------------------------ */
/*  CORS for API routes                                               */
/* ------------------------------------------------------------------ */

function handleApi(request: NextRequest): NextResponse {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
  }

  const response = NextResponse.next()
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

/* ------------------------------------------------------------------ */
/*  Admin Basic Auth                                                  */
/* ------------------------------------------------------------------ */

function handleAdminAuth(request: NextRequest): NextResponse | null {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return null

  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Heimdall Admin"' },
    })
  }

  const base64Credentials = authHeader.split(' ')[1]
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii')
  const [, password] = credentials.split(':')

  if (password !== adminPassword) {
    return new NextResponse('Invalid credentials', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Heimdall Admin"' },
    })
  }

  return null
}

/* ------------------------------------------------------------------ */
/*  Sheets cookie auth                                                */
/* ------------------------------------------------------------------ */

const SHEETS_COOKIE_NAME = 'heimdall-sheets-token'

function handleSheetsAuth(request: NextRequest): NextResponse | null {
  const sheetsPassword = process.env.SHEETS_PASSWORD
  if (!sheetsPassword) return null

  const { pathname } = request.nextUrl

  // Allow unauthenticated access to login page
  if (pathname === '/sheets/login') return null

  const token = request.cookies.get(SHEETS_COOKIE_NAME)?.value

  // Token is a base64-encoded SHEETS_PASSWORD — simple but effective for Phase 1
  if (token) {
    try {
      const decoded = Buffer.from(token, 'base64').toString('ascii')
      if (decoded === sheetsPassword) return null
    } catch {
      // Invalid token, redirect to login
    }
  }

  const url = request.nextUrl.clone()
  url.pathname = '/sheets/login'
  url.searchParams.set('redirect', pathname)
  return NextResponse.redirect(url)
}

/* ------------------------------------------------------------------ */
/*  Main middleware                                                    */
/* ------------------------------------------------------------------ */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Legacy redirects
  const redirect = legacyRedirect(request)
  if (redirect) return redirect

  // 2. API routes: CORS only
  if (pathname.startsWith('/api/')) {
    return handleApi(request)
  }

  // 3. Admin routes: Basic Auth
  if (pathname.startsWith('/admin')) {
    const denied = handleAdminAuth(request)
    if (denied) return denied
    return NextResponse.next()
  }

  // 4. Sheets routes: cookie-based auth
  if (pathname.startsWith('/sheets')) {
    const denied = handleSheetsAuth(request)
    if (denied) return denied
    return NextResponse.next()
  }

  // 5. Everything else (root landing, etc.)
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/sheets/:path*',
    '/api/:path*',
    // Legacy paths for redirects
    '/jobs/:path*',
    '/queue/:path*',
    '/routing/:path*',
    '/logs/:path*',
    '/settings/:path*',
    '/comments/:path*',
  ],
}
