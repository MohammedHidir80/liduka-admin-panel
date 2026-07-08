import { NextResponse } from 'next/server'

export function middleware(request) {
  const session = request.cookies.get('adminSession')?.value
  const { pathname } = request.nextUrl


  // Allow auth pages
  if (pathname.startsWith('/auth')) {
    return NextResponse.next()
  }


  // Protect admin routes
  if (pathname.startsWith('/admin') && !session) {
    const url = new URL('/auth/login', request.url)
    url.searchParams.set('callbackUrl', pathname)

    return NextResponse.redirect(url)
  }


  return NextResponse.next()
}


export const config = {
  matcher: [
    '/admin/:path*',
    '/auth/:path*',
  ],
}