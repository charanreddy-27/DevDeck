import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SESSION_TTL_MS,
  createSession,
  passwordMatches,
  sessionCookie,
  sessionKeyBytes,
  signSession,
  timingSafeEqual,
  verifySession,
} from '../lib/auth/session.js';
import { isGateEnabled, isPublicPath, safeNextPath } from '../lib/auth/gate.js';
import { createThrottle } from '../lib/auth/throttle.js';
import { scrub } from '../lib/errors.js';

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const KEY = new TextEncoder().encode('a-test-session-secret-of-decent-length');

test('a signed session verifies until it expires', async () => {
  const { value, expiresAt } = await createSession(KEY, NOW);
  assert.equal(expiresAt, NOW + SESSION_TTL_MS);
  assert.match(value, /^v1\.\d+\.[A-Za-z0-9_-]{43}$/);
  assert.equal(await verifySession(value, KEY, NOW), true);
  assert.equal(await verifySession(value, KEY, NOW + SESSION_TTL_MS - 1), true);
});

test('an expired session is rejected', async () => {
  const { value } = await createSession(KEY, NOW);
  assert.equal(await verifySession(value, KEY, NOW + SESSION_TTL_MS), false);
  assert.equal(await verifySession(value, KEY, NOW + SESSION_TTL_MS + 1), false);
});

test('a tampered session is rejected', async () => {
  const { value } = await createSession(KEY, NOW);
  const [version, expiry, signature] = value.split('.');

  // Extend the expiry without re-signing.
  assert.equal(await verifySession(`${version}.${Number(expiry) + 1000}.${signature}`, KEY, NOW), false);
  // Flip one signature character.
  const flipped = signature[0] === 'A' ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;
  assert.equal(await verifySession(`${version}.${expiry}.${flipped}`, KEY, NOW), false);
  // Wrong version, malformed and non-string values.
  assert.equal(await verifySession(`v2.${expiry}.${signature}`, KEY, NOW), false);
  for (const junk of ['', 'v1', 'v1..', `v1.${expiry}`, `v1.abc.${signature}`, `v1.${expiry}.${signature}.x`, null, 42]) {
    assert.equal(await verifySession(junk, KEY, NOW), false, `accepted ${junk}`);
  }
});

test('a session signed with another key is rejected', async () => {
  const { value } = await createSession(KEY, NOW);
  const other = new TextEncoder().encode('a-different-secret-entirely');
  assert.equal(await verifySession(value, other, NOW), false);
});

test('a validly signed token claiming more than the TTL is rejected', async () => {
  const forged = await signSession(NOW + SESSION_TTL_MS * 10, KEY);
  assert.equal(await verifySession(forged, KEY, NOW), false);
});

test('the key comes from DEVDECK_SESSION_SECRET, else is derived from the password', async () => {
  const explicit = await sessionKeyBytes({ DEVDECK_SESSION_SECRET: 'explicit-secret', DEVDECK_PASSWORD: 'pw' });
  assert.deepEqual(explicit, new TextEncoder().encode('explicit-secret'));

  const derivedA = await sessionKeyBytes({ DEVDECK_PASSWORD: 'correct horse' });
  const derivedB = await sessionKeyBytes({ DEVDECK_PASSWORD: 'correct horse' });
  const derivedC = await sessionKeyBytes({ DEVDECK_PASSWORD: 'battery staple' });
  assert.equal(derivedA.length, 32);
  assert.deepEqual(derivedA, derivedB);
  assert.notDeepEqual(derivedA, derivedC, 'changing the password invalidates sessions');
  assert.notDeepEqual(derivedA, new TextEncoder().encode('correct horse'), 'the key is not the password');

  await assert.rejects(sessionKeyBytes({}));
});

test('passwordMatches and timingSafeEqual compare exactly', async () => {
  assert.equal(await passwordMatches('test123', 'test123'), true);
  assert.equal(await passwordMatches('test124', 'test123'), false);
  assert.equal(await passwordMatches('test1234', 'test123'), false);
  assert.equal(await passwordMatches('', 'test123'), false);
  assert.equal(await passwordMatches('anything', ''), false);
  assert.equal(await passwordMatches(undefined, 'test123'), false);

  assert.equal(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
  assert.equal(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false);
  assert.equal(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0])), false);
});

test('the session cookie is HttpOnly, SameSite=Lax, 7 days, Secure when asked', () => {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const secure = sessionCookie('v1.1.sig', { expiresAt, secure: true });
  assert.match(secure, /^devdeck_session=v1\.1\.sig; Path=\//);
  assert.match(secure, /HttpOnly/);
  assert.match(secure, /SameSite=Lax/);
  assert.match(secure, /Max-Age=(604800|60479\d)/);
  assert.match(secure, /; Secure$/);
  assert.doesNotMatch(sessionCookie('x', { expiresAt, secure: false }), /Secure/);
});

test('safeNextPath only allows same-origin paths', () => {
  assert.equal(safeNextPath('/project/prj_1?tab=code'), '/project/prj_1?tab=code');
  assert.equal(safeNextPath('/'), '/');
  for (const hostile of [
    'https://evil.example/',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    '/%0d%0aSet-Cookie:x',
    'project',
    '',
    null,
    '/login?next=/x',
  ]) {
    const result = safeNextPath(hostile);
    assert.ok(result === '/' || (result.startsWith('/') && !result.startsWith('//')), `${hostile} -> ${result}`);
    assert.doesNotMatch(result, /evil|javascript|^\/login/);
  }
});

test('only the login page, its endpoint, assets and the OG image are public', () => {
  for (const path of ['/login', '/api/auth/login', '/_next/static/chunk.js', '/favicon.ico', '/icon.svg', '/opengraph-image']) {
    assert.equal(isPublicPath(path), true, path);
  }
  for (const path of ['/', '/about', '/project/x', '/api/vercel/projects', '/api/auth/logout', '/api/demo', '/api/status', '/loginx']) {
    assert.equal(isPublicPath(path), false, path);
  }
});

test('the gate is on only with a password and never under DEVDECK_DEMO', () => {
  assert.equal(isGateEnabled({}), false);
  assert.equal(isGateEnabled({ DEVDECK_PASSWORD: 'pw' }), true);
  assert.equal(isGateEnabled({ DEVDECK_PASSWORD: 'pw', DEVDECK_DEMO: '1' }), false);
});

test('the login throttle locks an IP out after repeated failures', () => {
  const throttle = createThrottle({ max: 3, windowMs: 60000 });
  for (let i = 0; i < 3; i += 1) {
    assert.equal(throttle.check('1.2.3.4', NOW).allowed, true);
    throttle.fail('1.2.3.4', NOW);
  }
  const blocked = throttle.check('1.2.3.4', NOW + 1000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 59000);
  assert.equal(throttle.check('5.6.7.8', NOW).allowed, true, 'other IPs are unaffected');
  assert.equal(throttle.check('1.2.3.4', NOW + 60000).allowed, true, 'the window expires');

  throttle.fail('9.9.9.9', NOW);
  throttle.reset('9.9.9.9');
  assert.equal(throttle.check('9.9.9.9', NOW).allowed, true);
});

test('scrub also covers the password and session secret', () => {
  const saved = { p: process.env.DEVDECK_PASSWORD, s: process.env.DEVDECK_SESSION_SECRET };
  process.env.DEVDECK_PASSWORD = 'hunter2-but-longer';
  process.env.DEVDECK_SESSION_SECRET = 'session-secret-value';
  try {
    assert.equal(scrub('pw hunter2-but-longer and session-secret-value'), 'pw [redacted] and [redacted]');
  } finally {
    for (const [key, value] of [['DEVDECK_PASSWORD', saved.p], ['DEVDECK_SESSION_SECRET', saved.s]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
