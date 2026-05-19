import { NextRequest, NextResponse } from 'next/server'

/**
 * Basic Auth middleware.
 * Защищает все страницы кроме /links (публичная linktree) и /api/* (свои guards).
 *
 * Env: DASHBOARD_PASSWORD — если не задан, middleware пропускает всех (dev-режим).
 * Логин: любой (игнорируется), пароль = DASHBOARD_PASSWORD.
 */

const PUBLIC_PATHS = ['/links', '/api/', '/_next/', '/favicon.ico', '/manifest.json']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export function proxy(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD
  if (!password) return NextResponse.next() // dev: не настроено — открыто

  if (isPublic(req.nextUrl.pathname)) return NextResponse.next()

  const auth = req.headers.get('authorization')
  if (auth) {
    const [scheme, encoded] = auth.split(' ')
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded)
      const [, pwd] = decoded.split(':')
      if (pwd === password) return NextResponse.next()
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Crypto Hunter OS"' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
