import { ApiError, ERROR_CODES, badRequest, errorResponse } from '@/lib/errors';
import { isGateEnabled, safeNextPath } from '@/lib/auth/gate';
import { createSession, passwordMatches, sessionCookie, sessionKeyBytes } from '@/lib/auth/session';
import { clientIp, createThrottle } from '@/lib/auth/throttle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Module-level so it survives across requests on a warm instance.
const throttle = createThrottle({ max: 5, windowMs: 15 * 60 * 1000 });

// Deliberately says nothing about *why* — no "password too short", no hint
// that would help someone guessing.
function wrongPassword() {
  return new ApiError('That password is not right.', { status: 401, code: ERROR_CODES.UNAUTHORIZED });
}

async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    const form = await request.formData();
    return { password: form.get('password'), next: form.get('next'), form: true };
  }
  try {
    const body = await request.json();
    return { password: body?.password, next: body?.next, form: false };
  } catch {
    throw badRequest('Expected a JSON body of { password }.');
  }
}

/**
 * POST /api/auth/login  { password, next? }
 *
 * Accepts JSON (the login page) or a plain form post (works without JS: the
 * response is then a 303 back to the page or on to `next`).
 */
export async function POST(request) {
  let form = false;
  let next = '/';
  try {
    if (!isGateEnabled()) {
      throw new ApiError('Password protection is not enabled on this deployment.', {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        hint: 'Set DEVDECK_PASSWORD to turn the password gate on.',
      });
    }

    const ip = clientIp(request);
    const gate = throttle.check(ip);
    if (!gate.allowed) {
      const error = new ApiError('Too many sign-in attempts.', {
        status: 429,
        code: ERROR_CODES.RATE_LIMITED,
        hint: `Wait ${Math.ceil(gate.retryAfterMs / 60000)} minutes and try again.`,
      });
      error.retryAfter = Math.ceil(gate.retryAfterMs / 1000);
      throw error;
    }

    const body = await readBody(request);
    form = body.form;
    next = safeNextPath(typeof body.next === 'string' ? body.next : '/');

    // Trailing newlines sneak into env values pasted through some CLIs.
    const expected = String(process.env.DEVDECK_PASSWORD || '').replace(/[\r\n]+$/, '');
    const ok = await passwordMatches(typeof body.password === 'string' ? body.password : '', expected);
    if (!ok) {
      throttle.fail(ip);
      throw wrongPassword();
    }
    throttle.reset(ip);

    const { value, expiresAt } = await createSession(await sessionKeyBytes());
    const cookie = sessionCookie(value, { expiresAt, secure: process.env.NODE_ENV === 'production' });

    if (form) {
      return new Response(null, { status: 303, headers: { Location: next, 'Set-Cookie': cookie } });
    }
    return Response.json({ ok: true, next }, { headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (form) {
      const back = new URLSearchParams({ error: error?.code || 'unauthorized', next });
      return new Response(null, { status: 303, headers: { Location: `/login?${back.toString()}` } });
    }
    const response = errorResponse(error);
    if (error?.retryAfter) response.headers.set('Retry-After', String(error.retryAfter));
    return response;
  }
}
