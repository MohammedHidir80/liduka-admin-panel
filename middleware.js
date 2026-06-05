import { NextResponse } from 'next/server'

export function middleware(request) {
  const token = request.cookies.get('firebaseAuthToken')?.value
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/auth') || pathname === '/') {
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin') && !token) {
    const url = new URL('/auth/login', request.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/auth/:path*'],
}