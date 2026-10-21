/**
 * Fuzzy matching for the command palette. Pure, so it is tested directly.
 *
 * A query matches when its characters appear in order (a subsequence). The
 * score rewards what people mean when they type: a contiguous substring beats
 * a scatter, matches at word starts beat matches mid-word, earlier beats later,
 * and shorter targets beat longer ones on a tie.
 */

const WORD_BREAK = /[\s\-_/.:]/;

function isWordStart(text, index) {
  return index === 0 || WORD_BREAK.test(text[index - 1]);
}

/** @returns {number|null} higher is better; null means no match */
export function fuzzyScore(query, text) {
  const q = String(query || '').trim().toLowerCase();
  const t = String(text || '').toLowerCase();
  if (!q) return 0;
  if (!t) return null;

  const at = t.indexOf(q);
  if (at !== -1) {
    // A whole-substring hit always outranks any scattered subsequence.
    return 1000 + (isWordStart(t, at) ? 200 : 0) - at * 2 - (t.length - q.length) * 0.1;
  }

  let score = 0;
  let from = 0;
  let previous = -2;
  let first = -1;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, from);
    if (found === -1) return null;
    if (first === -1) first = found;
    score += found === previous + 1 ? 15 : 1;
    if (isWordStart(t, found)) score += 10;
    previous = found;
    from = found + 1;
  }
  return score - first * 0.5 - t.length * 0.05;
}

/**
 * Filters and sorts `items` by their best-matching key. Stable for equal
 * scores, so callers control the order of ties (e.g. projects before actions).
 *
 * @param {Array<T>} items
 * @param {string} query
 * @param {(item: T) => string[]} keys  every string an item can be found by
 * @returns {Array<T>}
 */
export function rankItems(items, query, keys) {
  if (!String(query || '').trim()) return items.slice();
  return items
    .map((item, index) => {
      let best = null;
      for (const key of keys(item)) {
        const score = fuzzyScore(query, key);
        if (score !== null && (best === null || score > best)) best = score;
      }
      return { item, index, best };
    })
    .filter((entry) => entry.best !== null)
    .sort((a, b) => b.best - a.best || a.index - b.index)
    .map((entry) => entry.item);
}
