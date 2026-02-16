/**
 * Simple password-based authentication middleware for Heimdall admin panel.
 * For production, use Vercel Authentication (requires Pro plan).
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function middleware(request: NextRequest) {
  // Handle CORS for API routes (Figma plugin runs in sandboxed iframe with null origin)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Respond to preflight OPTIONS immediately
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
    }

    // For actual requests, attach CORS headers to the response
    const response = NextResponse.next()
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value)
    }
    return response
  }

  const adminPassword = process.env.ADMIN_PASSWORD
  
  // If no password set, allow access (dev mode)
  if (!adminPassword) {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Heimdall Admin"',
      },
    })
  }

  const base64Credentials = authHeader.split(' ')[1]
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii')
  const [username, password] = credentials.split(':')

  if (password !== adminPassword) {
    return new NextResponse('Invalid credentials', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Heimdall Admin"',
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/jobs/:path*', '/queue/:path*', '/routing/:path*', '/logs/:path*', '/settings/:path*', '/comments/:path*', '/api/:path*'],
}
