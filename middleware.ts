/**
 * Simple password-based authentication middleware for Bifrost admin panel.
 * For production, use Vercel Authentication (requires Pro plan).
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Skip auth for API routes (they need to be accessible from Figma plugin)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
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
        'WWW-Authenticate': 'Basic realm="Bifrost Admin"',
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
        'WWW-Authenticate': 'Basic realm="Bifrost Admin"',
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/jobs/:path*', '/queue/:path*', '/routing/:path*', '/settings/:path*'],
}
