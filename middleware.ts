import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'iq-session';

// Paths that never require auth
const PUBLIC = ['/login', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through public paths and static assets
  if (PUBLIC.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const secret  = process.env.AUTH_SECRET;

  // 1. Check for valid Authorization header (for Android app / webhooks)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader === `Bearer ${secret}`) {
    return NextResponse.next();
  }

  // 2. Check for valid session cookie (for web UI)
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (!session || !secret || session !== secret) {
    const loginUrl = new URL('/login', request.url);
    // Preserve intended destination
    if (pathname !== '/') loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|icons|favicon.ico|manifest.json|apple-touch-icon.png).*)'],
};
