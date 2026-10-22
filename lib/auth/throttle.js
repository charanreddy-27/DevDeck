/**
 * A small in-memory, per-IP throttle for the login endpoint. Per instance on
 * serverless, so it is a speed bump rather than a wall — but a password guess
 * per few minutes per IP per instance turns online brute force from minutes
 * into years, which is the point.
 */

export function createThrottle({ max = 5, windowMs = 15 * 60 * 1000, maxKeys = 5000 } = {}) {
  const failures = new Map(); // key -> { count, resetAt }

  function current(key, now) {
    const entry = failures.get(key);
    if (entry && entry.resetAt <= now) {
      failures.delete(key);
      return null;
    }
    return entry || null;
  }

  return {
    /** @returns {{ allowed: boolean, retryAfterMs: number }} */
    check(key, now = Date.now()) {
      const entry = current(key, now);
      if (entry && entry.count >= max) return { allowed: false, retryAfterMs: entry.resetAt - now };
      return { allowed: true, retryAfterMs: 0 };
    },

    fail(key, now = Date.now()) {
      const entry = current(key, now);
      if (entry) {
        entry.count += 1;
        return;
      }
      // Bound memory: drop the oldest entry rather than grow without limit.
      if (failures.size >= maxKeys) failures.delete(failures.keys().next().value);
      failures.set(key, { count: 1, resetAt: now + windowMs });
    },

    reset(key) {
      failures.delete(key);
    },
  };
}

/** Best-effort client IP. On Vercel the first x-forwarded-for hop is the client. */
export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}
