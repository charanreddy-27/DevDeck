/**
 * Which data source answers a request. Deliberately import-free so the proxy
 * (which runs before every request) can use it without pulling in either
 * provider.
 *
 * The rules, in order:
 *   1. DEVDECK_DEMO=1 forces demo for everyone and ignores any tokens — the
 *      public-deployment mode, safe by construction because no code path can
 *      reach a real account.
 *   2. If any real token is configured, the demo cookie is ignored. Fake data
 *      must never be shown over a real account by accident.
 *   3. Otherwise a `devdeck_demo=1` cookie opts this browser into demo data.
 *   4. Otherwise live — which, with no tokens, renders the setup guide.
 */

export const DEMO_COOKIE = 'devdeck_demo';

function truthy(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isDemoForced(env = process.env) {
  return truthy(env.DEVDECK_DEMO);
}

export function hasAnyToken(env = process.env) {
  return present(env.VERCEL_TOKEN) || present(env.GITHUB_TOKEN);
}

/** Reads one cookie out of a raw Cookie header without a dependency. */
export function readCookie(header, name) {
  if (!header) return null;
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

/**
 * @returns {{ mode: 'live' | 'demo', forced: boolean, available: boolean, reason: string }}
 *   `available` says whether this browser could switch demo on or off right now.
 */
export function resolveMode({ env = process.env, cookieHeader = null } = {}) {
  if (isDemoForced(env)) {
    return { mode: 'demo', forced: true, available: true, reason: 'env' };
  }
  if (hasAnyToken(env)) {
    return { mode: 'live', forced: false, available: false, reason: 'tokens' };
  }
  if (truthy(readCookie(cookieHeader, DEMO_COOKIE))) {
    return { mode: 'demo', forced: false, available: true, reason: 'cookie' };
  }
  return { mode: 'live', forced: false, available: true, reason: 'default' };
}

export function modeForRequest(request, env = process.env) {
  return resolveMode({ env, cookieHeader: request?.headers?.get?.('cookie') ?? null });
}
