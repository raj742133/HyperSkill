import { NextRequest, NextResponse } from 'next/server';

/**
 * The gate.
 *
 * Everything is behind the password except what cannot be: the public pages, the sign-in page itself, and the endpoints
 * clients use - which carry their own bearer token and are checked in the route handlers. The list below is generated from
 * the modules you chose (OPEN in this file); a path is open if it equals an entry or sits under an entry ending in "/".
 *
 * It only checks that a signed cookie is PRESENT and well-formed, not that its HMAC verifies, because middleware runs on the
 * edge runtime where node:crypto is not available. The pages and API routes behind it verify properly with `isSignedIn()`.
 * So this is a fast redirect for the common case, not the security boundary - the boundary is in the handlers.
 */
const OPEN: string[] = __OPEN_PATHS_JSON__;

function isOpen(pathname: string): boolean {
  return OPEN.some((p) => {
    if (p === '/') return pathname === '/'; // the home page itself, never "everything under /"
    const bare = p.replace(/\/$/, '');
    return pathname === bare || pathname.startsWith(`${bare}/`);
  });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isOpen(pathname)) return NextResponse.next();

  const cookie = req.cookies.get('__COOKIE__-session')?.value;
  if (cookie && /^\d+\.[a-f0-9]{64}$/.test(cookie)) return NextResponse.next();

  // An API caller gets a status, not a redirect to an HTML page.
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // The release upload is left out: Next buffers a request that passes through middleware and cuts its body at 10 MB, so a big
  // file arrived truncated. That route checks the publisher's sign-in itself (lib/admin.ts), like every /api/admin route.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|api/admin/releases$).*)'],
};
