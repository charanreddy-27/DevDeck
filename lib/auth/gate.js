/**
 * The password gate's routing rules, kept separate from the proxy so they are
 * plain functions with tests instead of logic buried in a framework hook.
 */
import { isDemoForced } from '../source/mode.js';
import { isAuthConfigured } from './session.js';

export const LOGIN_PATH = '/login';

/** The gate is on when a password is set — unless the deployment is a forced demo. */
export function isGateEnabled(env = process.env) {
  return isAuthConfigured(env) && !isDemoForced(env);
}

// Reachable without a session: the login page and its endpoint, framework
// assets, and the public metadata files a link preview needs.
const PUBLIC_EXACT = new Set([
  LOGIN_PATH,
  '/api/auth/login',
  '/favicon.ico',
  '/icon.svg',
  '/opengraph-image',
  '/robots.txt',
]);

export function isPublicPath(pathname) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith('/_next/')) return true;
  // opengraph-image can be served with a hash suffix (/opengraph-image-abc123).
  if (pathname.startsWith('/opengraph-image')) return true;
  return false;
}

/**
 * Only same-origin paths survive as a post-login redirect target. Anything
 * else — absolute URLs, protocol-relative `//evil.com`, backslash tricks,
 * control characters — collapses to `/`.
 */
export function safeNextPath(next) {
  if (typeof next !== 'string' || !next) return '/';
  if (!next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(next)) return '/';
  try {
    const base = 'http://devdeck.invalid';
    const url = new URL(next, base);
    if (url.origin !== base) return '/';
    const path = `${url.pathname}${url.search}${url.hash}`;
    // Bouncing back to /login after logging in would be a loop.
    return url.pathname === LOGIN_PATH ? '/' : path;
  } catch {
    return '/';
  }
}

/** The 401 body for API calls without a session, in DevDeck's error envelope. */
export function unauthorizedBody() {
  return {
    error: {
      code: 'unauthorized',
      message: 'Sign in to use DevDeck.',
      hint: `This deployment is password protected. Open ${LOGIN_PATH} and enter the DevDeck password.`,
      service: null,
    },
  };
}
