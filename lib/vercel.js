import { ApiError, ERROR_CODES, missingToken } from './errors.js';

const BASE = 'https://api.vercel.com';

export function vercelToken() {
  const token = process.env.VERCEL_TOKEN;
  return typeof token === 'string' ? token.trim() : '';
}

export function vercelTeamId() {
  const team = process.env.VERCEL_TEAM_ID;
  return typeof team === 'string' ? team.trim() : '';
}

export function hasVercelToken() {
  return vercelToken().length > 0;
}

function buildUrl(path, query) {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const team = vercelTeamId();
  if (team) url.searchParams.set('teamId', team);
  return url;
}

function upstreamError(status, payload) {
  const detail = payload?.error?.message || payload?.message || '';

  if (status === 401) {
    return new ApiError('Vercel rejected VERCEL_TOKEN.', {
      status: 401,
      code: ERROR_CODES.BAD_TOKEN,
      service: 'vercel',
      hint: 'The token is invalid, expired, or was revoked. Create a fresh one at vercel.com/account/tokens and update .env.local.',
    });
  }
  // Vercel answers 403 "Not authorized" for an invalid token as well as for a
  // token pointed at the wrong scope. Both are fixed in .env.local, so both
  // route to the setup guide rather than a small banner.
  if (status === 403) {
    return new ApiError(detail ? `Vercel denied access: ${detail}` : 'Vercel denied access.', {
      status: 403,
      code: ERROR_CODES.BAD_TOKEN,
      service: 'vercel',
      hint: vercelTeamId()
        ? 'Check that VERCEL_TOKEN is valid and that it has access to the team in VERCEL_TEAM_ID.'
        : 'Either VERCEL_TOKEN is invalid/expired, or your projects live under a Vercel team — in which case set VERCEL_TEAM_ID in .env.local.',
    });
  }
  if (status === 404) {
    return new ApiError(detail || 'Vercel could not find that resource.', {
      status: 404,
      code: ERROR_CODES.NOT_FOUND,
      service: 'vercel',
    });
  }
  if (status === 429) {
    return new ApiError('Vercel rate limit reached.', {
      status: 429,
      code: ERROR_CODES.RATE_LIMITED,
      service: 'vercel',
      hint: 'Wait a minute before refreshing — DevDeck polls every 30 seconds.',
    });
  }

  return new ApiError(detail || `Vercel API returned ${status}.`, {
    status: status >= 500 ? 502 : status,
    code: ERROR_CODES.UPSTREAM,
    service: 'vercel',
  });
}

/**
 * Calls the Vercel REST API with the server-side token.
 * `teamId` is appended automatically when VERCEL_TEAM_ID is configured.
 */
export async function vercelFetch(path, options = {}) {
  const { method = 'GET', query, body, raw = false } = options;
  const token = vercelToken();
  if (!token) throw missingToken('vercel', 'VERCEL_TOKEN');

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Could not reach api.vercel.com.', {
      status: 502,
      code: ERROR_CODES.NETWORK,
      service: 'vercel',
      hint: 'Check your network connection or proxy settings.',
    });
  }

  const text = await response.text();

  if (!response.ok) {
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      /* non-JSON error body */
    }
    throw upstreamError(response.status, payload);
  }

  if (raw) return text;
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('Vercel returned a response DevDeck could not parse.', {
      status: 502,
      code: ERROR_CODES.UPSTREAM,
      service: 'vercel',
    });
  }
}
