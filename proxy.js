import { NextResponse } from 'next/server';
import { LOGIN_PATH, isGateEnabled, isPublicPath, unauthorizedBody } from '@/lib/auth/gate';
import { SESSION_COOKIE, sessionKeyBytes, verifySession } from '@/lib/auth/session';

/**
 * The optional password gate (Next.js 16 renamed middleware to proxy; it runs
 * on the Node.js runtime before any route renders).
 *
 * Off unless DEVDECK_PASSWORD is set, and always off under DEVDECK_DEMO=1 —
 * a forced demo holds no real tokens, so there is nothing to protect. When on,
 * everything except the login page, its endpoint, framework assets and the OG
 * image needs a valid signed session cookie:
 *   - API requests get a 401 in the standard error envelope
 *   - page requests are redirected to /login?next=<where they were going>
 */
export async function proxy(request) {
  if (!isGateEnabled()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySession(token, await sessionKeyBytes()))) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(unauthorizedBody(), { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const login = new URL(LOGIN_PATH, request.url);
  login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Static build output and image optimisation never need a session check;
  // skipping them here keeps the proxy off the hot path for assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
