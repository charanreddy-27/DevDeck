/**
 * Every JSON response from a data route carries a top-level `mode` so the
 * client can show the demo banner without a second request. Success and error
 * bodies both get it; the existing shapes are otherwise untouched.
 */
import { errorResponse } from '../errors.js';

export function respond(source, body, init) {
  return Response.json({ ...body, mode: source.mode }, init);
}

export function respondError(source, error) {
  return errorResponse(error, { mode: source?.mode || 'live' });
}

/** Parses a JSON request body, or throws the given bad-request error. */
export async function readJson(request, onInvalid) {
  try {
    return await request.json();
  } catch {
    throw onInvalid;
  }
}
