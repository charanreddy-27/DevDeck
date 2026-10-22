'use client';

// ---- data-source mode -----------------------------------------------------
// Every data route reports `mode: 'live' | 'demo'`. fetchJson records the
// latest value here so the shell can show the demo banner without a request
// of its own (useSyncExternalStore subscribes to it).

let currentMode = null;
const modeListeners = new Set();

export function reportMode(mode) {
  if ((mode !== 'live' && mode !== 'demo') || mode === currentMode) return;
  currentMode = mode;
  for (const listener of modeListeners) listener();
}

export function subscribeMode(listener) {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
}

export function getMode() {
  return currentMode;
}

// ---- navigation -------------------------------------------------------------

/**
 * A full page load, on purpose. Used after signing in/out or switching demo
 * mode: the server must see the new cookie on the very next request, and every
 * poll, cache and piece of client state from the old mode has to go with it.
 * A client-side router push would keep all of that alive.
 */
export function hardNavigate(path) {
  window.location.assign(path);
}

// ---- fetch ------------------------------------------------------------------

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

  if (payload?.mode) reportMode(payload.mode);

  // The password gate answers 401 `unauthorized` once a session expires; the
  // only useful thing to do with that is go and sign in again.
  if (response.status === 401 && payload?.error?.code === 'unauthorized' && typeof window !== 'undefined') {
    if (window.location.pathname !== '/login') {
      const next = `${window.location.pathname}${window.location.search}`;
      hardNavigate(`/login?next=${encodeURIComponent(next)}`);
    }
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
