/**
 * Seeded randomness for the demo. Every value the demo invents comes from a
 * generator seeded by a stable string (project name, deployment index), never
 * from Math.random — that is what makes the same clock produce the same data
 * on every request and every serverless instance.
 */

/** FNV-1a, 32-bit. Small, fast, and plenty for seeding. */
export function hashString(input) {
  let hash = 0x811c9dc5;
  const str = String(input);
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const HEX = '0123456789abcdef';
const LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** mulberry32 wrapped with the handful of helpers the generators need. */
export function createRng(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashString(seed);

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const rng = {
    next,
    /** Float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Integer in [min, max]. */
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    chars: (alphabet, length) => {
      let out = '';
      for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(next() * alphabet.length)];
      return out;
    },
    hex: (length) => rng.chars(HEX, length),
    base62: (length) => rng.chars(BASE62, length),
    slug: (length) => rng.chars(LOWER, length),
  };
  return rng;
}
