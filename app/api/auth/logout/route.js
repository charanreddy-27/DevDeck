import { clearedSessionCookie } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/auth/logout — clears the session cookie. Sessions are stateless, so that is all logout is. */
export async function POST() {
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': clearedSessionCookie({ secure: process.env.NODE_ENV === 'production' }), 'Cache-Control': 'no-store' } },
  );
}
