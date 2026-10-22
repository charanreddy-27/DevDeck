import { ApiError, ERROR_CODES, errorResponse } from '@/lib/errors';
import { DEMO_COOKIE, hasAnyToken, isDemoForced } from '@/lib/source';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const THIRTY_DAYS = 30 * 24 * 60 * 60;

function cookie(value, maxAge) {
  return [
    `${DEMO_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    process.env.NODE_ENV === 'production' ? 'Secure' : null,
  ]
    .filter(Boolean)
    .join('; ');
}

/**
 * POST /api/demo → opt this browser into demo data (sets devdeck_demo=1).
 *
 * Refused while real tokens are configured: the cookie would be ignored
 * anyway (fake data never shows over a real account), and saying so beats a
 * button that silently does nothing.
 */
export async function POST() {
  if (!isDemoForced() && hasAnyToken()) {
    return errorResponse(
      new ApiError('Demo mode is off while real tokens are configured.', {
        status: 409,
        code: ERROR_CODES.CONFLICT,
        hint: 'DevDeck never shows simulated data over a real account. Remove the tokens, or set DEVDECK_DEMO=1 for a public demo deployment.',
      }),
      { mode: 'live' },
    );
  }
  return Response.json({ ok: true, mode: 'demo' }, { headers: { 'Set-Cookie': cookie('1', THIRTY_DAYS), 'Cache-Control': 'no-store' } });
}

/** DELETE /api/demo → leave demo mode (clears the cookie). Impossible under DEVDECK_DEMO=1. */
export async function DELETE() {
  if (isDemoForced()) {
    return errorResponse(
      new ApiError('This deployment always runs in demo mode.', {
        status: 409,
        code: ERROR_CODES.CONFLICT,
        hint: 'DEVDECK_DEMO=1 is set, so there is no live account to switch to.',
      }),
      { mode: 'demo' },
    );
  }
  return Response.json({ ok: true, mode: 'live' }, { headers: { 'Set-Cookie': cookie('', 0), 'Cache-Control': 'no-store' } });
}
