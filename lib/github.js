import { ApiError, ERROR_CODES, missingToken } from './errors.js';

const BASE = 'https://api.github.com';

export function githubToken() {
  const token = process.env.GITHUB_TOKEN;
  return typeof token === 'string' ? token.trim() : '';
}

export function hasGithubToken() {
  return githubToken().length > 0;
}

/** Encodes a repo path without destroying its slashes. */
export function encodePath(path) {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function upstreamError(status, payload, headers) {
  const detail = payload?.message || '';
  const rateRemaining = headers?.get('x-ratelimit-remaining');

  if (status === 401) {
    return new ApiError('GitHub rejected GITHUB_TOKEN.', {
      status: 401,
      code: ERROR_CODES.BAD_TOKEN,
      service: 'github',
      hint: 'The token is invalid or expired. Create a new one at github.com/settings/tokens with the `repo` scope.',
    });
  }
  if (status === 403 && rateRemaining === '0') {
    return new ApiError('GitHub rate limit reached.', {
      status: 429,
      code: ERROR_CODES.RATE_LIMITED,
      service: 'github',
      hint: 'Authenticated requests reset hourly. Wait a few minutes and try again.',
    });
  }
  if (status === 403) {
    return new ApiError(detail || 'GitHub denied access to that resource.', {
      status: 403,
      code: ERROR_CODES.FORBIDDEN,
      service: 'github',
      hint: 'Your token needs the `repo` scope (classic) or Contents: read & write (fine-grained) for this repository.',
    });
  }
  if (status === 404) {
    return new ApiError(detail || 'GitHub could not find that repository, branch, or file.', {
      status: 404,
      code: ERROR_CODES.NOT_FOUND,
      service: 'github',
      hint: 'For private repositories, make sure the token has access to this specific repo.',
    });
  }
  if (status === 409 || status === 422) {
    return new ApiError(detail || 'GitHub rejected the commit.', {
      status: 409,
      code: ERROR_CODES.CONFLICT,
      service: 'github',
      hint: 'The file changed on GitHub since it was loaded. Reload the file and reapply your edit.',
    });
  }

  return new ApiError(detail || `GitHub API returned ${status}.`, {
    status: status >= 500 ? 502 : status,
    code: ERROR_CODES.UPSTREAM,
    service: 'github',
  });
}

/** Calls the GitHub REST API with the server-side token. */
export async function githubFetch(path, options = {}) {
  const { method = 'GET', query, body } = options;
  const token = githubToken();
  if (!token) throw missingToken('github', 'GITHUB_TOKEN');

  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'devdeck',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Could not reach api.github.com.', {
      status: 502,
      code: ERROR_CODES.NETWORK,
      service: 'github',
      hint: 'Check your network connection or proxy settings.',
    });
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }

  if (!response.ok) throw upstreamError(response.status, payload, response.headers);
  return payload;
}

export function decodeBase64(content) {
  return Buffer.from(String(content || '').replace(/\s/g, ''), 'base64').toString('utf8');
}

export function encodeBase64(content) {
  return Buffer.from(String(content ?? ''), 'utf8').toString('base64');
}
