/**
 * Shared error shape for every route handler.
 *
 * Route handlers always answer with `{ error: { code, message, hint, service } }`
 * so the client can branch on `code` (e.g. show the setup guide for a bad token)
 * instead of pattern-matching on English strings.
 */

export const ERROR_CODES = {
  MISSING_TOKEN: 'missing_token',
  BAD_TOKEN: 'bad_token',
  FORBIDDEN: 'forbidden',
  RATE_LIMITED: 'rate_limited',
  NOT_FOUND: 'not_found',
  BAD_REQUEST: 'bad_request',
  CONFLICT: 'conflict',
  NETWORK: 'network_error',
  UPSTREAM: 'upstream_error',
  INTERNAL: 'internal_error',
};

/**
 * Strips any configured secret out of a string before it can reach a log line
 * or an HTTP response. Upstream APIs occasionally echo request context back.
 */
export function scrub(value) {
  if (value == null) return value;
  let out = String(value);
  for (const secret of [process.env.VERCEL_TOKEN, process.env.GITHUB_TOKEN, process.env.VERCEL_TEAM_ID]) {
    if (typeof secret === 'string' && secret.trim().length > 6) {
      out = out.split(secret.trim()).join('[redacted]');
    }
  }
  return out;
}

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(scrub(message));
    this.name = 'ApiError';
    this.status = options.status || 500;
    this.code = options.code || ERROR_CODES.UPSTREAM;
    this.hint = options.hint ? scrub(options.hint) : null;
    this.service = options.service || null;
  }
}

export function missingToken(service, varName) {
  return new ApiError(`${varName} is not set.`, {
    status: 401,
    code: ERROR_CODES.MISSING_TOKEN,
    service,
    hint: `Create ${varName} in .env.local (copy .env.example), then restart the dev server.`,
  });
}

export function badRequest(message, hint) {
  return new ApiError(message, { status: 400, code: ERROR_CODES.BAD_REQUEST, hint });
}

/** Turns any thrown value into the canonical JSON error response. */
export function errorResponse(error) {
  const known = error instanceof ApiError;

  if (!known) {
    // Message only — never headers, never request bodies.
    console.error('[devdeck] unexpected error:', scrub(error?.message || String(error)));
  }

  return Response.json(
    {
      error: {
        code: known ? error.code : ERROR_CODES.INTERNAL,
        message: known ? error.message : 'DevDeck hit an unexpected error handling that request.',
        hint: known ? error.hint : null,
        service: known ? error.service : null,
      },
    },
    { status: known ? error.status : 500 },
  );
}
