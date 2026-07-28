'use client';

/** Thin fetch wrapper that turns DevDeck's JSON error envelope into a real Error. */
export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Request failed with status ${response.status}.`);
    error.code = payload?.error?.code || 'unknown';
    error.hint = payload?.error?.hint || null;
    error.service = payload?.error?.service || null;
    error.status = response.status;
    throw error;
  }

  return payload;
}

/** Token problems get the full setup guide instead of a small error banner. */
export function isTokenProblem(error) {
  return error?.code === 'missing_token' || error?.code === 'bad_token';
}
