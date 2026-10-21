/**
 * Session cookies for the optional password gate.
 *
 * A session is nothing but a signed expiry: `v1.<expiresAt>.<hmac>` where the
 * HMAC-SHA256 covers "v1.<expiresAt>". No user id, no server-side store —
 * there is exactly one user, and "knows the password" is the whole identity.
 *
 * Web Crypto only (globalThis.crypto.subtle), so the same module runs in the
 * proxy, in route handlers and under node:test.
 *
 * Key: DEVDECK_SESSION_SECRET if set, otherwise derived from DEVDECK_PASSWORD.
 * The derived key means a password change logs every session out — which is
 * what you want after rotating a password you think leaked.
 */

export const SESSION_COOKIE = 'devdeck_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VERSION = 'v1';
// A signature we issued can never claim more than TTL of life; this bounds
// the damage if a clock is wrong when a cookie is minted.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const encoder = new TextEncoder();

function subtle() {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new Error('Web Crypto is unavailable in this runtime.');
  return api;
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Compares two byte arrays in time that depends only on their length. */
export function timingSafeEqual(a, b) {
  const x = a instanceof Uint8Array ? a : new Uint8Array(a);
  const y = b instanceof Uint8Array ? b : new Uint8Array(b);
  let diff = x.length ^ y.length;
  const length = Math.max(x.length, y.length);
  for (let i = 0; i < length; i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

async function sha256(text) {
  return new Uint8Array(await subtle().digest('SHA-256', encoder.encode(text)));
}

export function isAuthConfigured(env = process.env) {
  return typeof env.DEVDECK_PASSWORD === 'string' && env.DEVDECK_PASSWORD.length > 0;
}

/**
 * Raw HMAC key bytes. Domain-separated so the derived key is never the same
 * bytes as anything else computed from the password.
 */
export async function sessionKeyBytes(env = process.env) {
  const secret = typeof env.DEVDECK_SESSION_SECRET === 'string' ? env.DEVDECK_SESSION_SECRET.trim() : '';
  if (secret) return encoder.encode(secret);
  if (!isAuthConfigured(env)) throw new Error('DEVDECK_PASSWORD is not set.');
  return sha256(`devdeck/session-key/v1\u0000${env.DEVDECK_PASSWORD}`);
}

async function hmacKey(keyBytes) {
  return subtle().importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** @returns {Promise<string>} the cookie value for a session expiring at `expiresAt` (epoch ms) */
export async function signSession(expiresAt, keyBytes) {
  const payload = `${VERSION}.${Math.floor(expiresAt)}`;
  const signature = await subtle().sign('HMAC', await hmacKey(keyBytes), encoder.encode(payload));
  return `${payload}.${toBase64Url(signature)}`;
}

export async function createSession(keyBytes, now = Date.now()) {
  const expiresAt = now + SESSION_TTL_MS;
  return { value: await signSession(expiresAt, keyBytes), expiresAt };
}

/**
 * True only for a well-formed, correctly signed, unexpired token. The HMAC
 * check uses subtle.verify, which compares in constant time.
 */
export async function verifySession(token, keyBytes, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 200) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION || !/^\d{1,16}$/.test(parts[1])) return false;

  const signature = fromBase64Url(parts[2]);
  if (!signature || signature.length !== 32) return false;

  let valid = false;
  try {
    valid = await subtle().verify('HMAC', await hmacKey(keyBytes), signature, encoder.encode(`${parts[0]}.${parts[1]}`));
  } catch {
    return false;
  }
  if (!valid) return false;

  const expiresAt = Number(parts[1]);
  return expiresAt > now && expiresAt <= now + SESSION_TTL_MS + CLOCK_SKEW_MS;
}

/**
 * Constant-time password check. Both sides are hashed first so the
 * comparison is always 32 bytes against 32 bytes — no early exit on length,
 * no early exit on the first differing character.
 */
export async function passwordMatches(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string' || !expected) return false;
  const [a, b] = await Promise.all([sha256(candidate), sha256(expected)]);
  return timingSafeEqual(a, b);
}

/** Set-Cookie header value for a fresh session. */
export function sessionCookie(value, { expiresAt, secure }) {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  return [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
    secure ? 'Secure' : null,
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearedSessionCookie({ secure }) {
  return [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', secure ? 'Secure' : null]
    .filter(Boolean)
    .join('; ');
}
