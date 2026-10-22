import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_EDIT_DISTANCE, diffLines, splitLines, toHunks } from '../lib/diff.js';
import { fuzzyScore, rankItems } from '../lib/fuzzy.js';

// ---- diff ------------------------------------------------------------------

/** Applies ops back onto the old text: a diff is right iff it rebuilds the new one. */
function apply(ops) {
  return ops.filter((op) => op.type !== 'del').map((op) => op.line);
}

test('splitLines treats a trailing newline as the end of a line, not a new one', () => {
  assert.deepEqual(splitLines('a\nb\n'), ['a', 'b']);
  assert.deepEqual(splitLines('a\nb'), ['a', 'b']);
  assert.deepEqual(splitLines(''), []);
  assert.deepEqual(splitLines('\n'), ['']);
});

test('identical text has no changes and no hunks', () => {
  const result = diffLines('one\ntwo\n', 'one\ntwo\n');
  assert.equal(result.added, 0);
  assert.equal(result.removed, 0);
  assert.deepEqual(toHunks(result.ops), []);
});

test('a one-line edit is one deletion and one addition', () => {
  const result = diffLines('a\nb\nc\n', 'a\nB\nc\n');
  assert.equal(result.added, 1);
  assert.equal(result.removed, 1);
  assert.deepEqual(apply(result.ops), ['a', 'B', 'c']);
});

test('insertions and deletions at both ends round-trip', () => {
  const cases = [
    ['b\nc', 'a\nb\nc'],
    ['a\nb', 'a\nb\nc'],
    ['a\nb\nc', 'b\nc'],
    ['a\nb\nc', 'a\nb'],
    ['', 'x\ny'],
    ['x\ny', ''],
  ];
  for (const [before, after] of cases) {
    const result = diffLines(before, after);
    assert.deepEqual(apply(result.ops), splitLines(after), `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  }
});

test('the diff is minimal for interleaved edits', () => {
  const before = ['keep 1', 'old a', 'keep 2', 'old b', 'keep 3'].join('\n');
  const after = ['keep 1', 'new a', 'keep 2', 'keep 3', 'tail'].join('\n');
  const result = diffLines(before, after);
  assert.deepEqual(apply(result.ops), splitLines(after));
  assert.equal(result.added, 2);
  assert.equal(result.removed, 2);
});

test('hunks carry context and line numbers, and nearby changes share a hunk', () => {
  const before = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n');
  const lines = before.split('\n');
  lines[4] = 'changed 5';
  lines[6] = 'changed 7';
  lines[24] = 'changed 25';
  const result = diffLines(before, lines.join('\n'));
  const hunks = toHunks(result.ops, 3);
  assert.equal(hunks.length, 2, 'edits at 5 and 7 merge; 25 is its own hunk');
  assert.equal(hunks[0].oldStart, 2);
  assert.equal(hunks[0].lines[0].text, 'line 2');
  const del = hunks[0].lines.find((row) => row.type === 'del');
  assert.equal(del.oldNo, 5);
  assert.equal(hunks[1].lines.find((row) => row.type === 'add').newNo, 25);
});

test('huge rewrites bail out instead of grinding', () => {
  const before = Array.from({ length: MAX_EDIT_DISTANCE + 50 }, (_, i) => `a${i}`).join('\n');
  const after = Array.from({ length: MAX_EDIT_DISTANCE + 50 }, (_, i) => `b${i}`).join('\n');
  const started = Date.now();
  const result = diffLines(before, after);
  assert.equal(result.tooLarge, true);
  assert.equal(result.ops, null);
  assert.ok(result.added > 0 && result.removed > 0);
  assert.ok(Date.now() - started < 5000, 'must stay fast');
});

// ---- fuzzy -----------------------------------------------------------------

test('fuzzyScore matches subsequences and rejects missing characters', () => {
  assert.ok(fuzzyScore('dvdk', 'dev-deck') !== null);
  assert.equal(fuzzyScore('xyz', 'dev-deck'), null);
  assert.equal(fuzzyScore('', 'anything'), 0);
});

test('substrings beat scatters, and word starts beat mid-word hits', () => {
  assert.ok(fuzzyScore('deck', 'dev-deck') > fuzzyScore('deck', 'd-e-c-k-s'));
  assert.ok(fuzzyScore('port', 'charan-portfolio') > fuzzyScore('port', 'support-desk'));
});

test('rankItems sorts by best key and keeps ties stable', () => {
  const items = [
    { name: 'synapse-web', repo: 'charanreddy-27/synapse-web' },
    { name: 'dev-deck', repo: 'charanreddy-27/dev-deck' },
    { name: 'distill', repo: 'charanreddy-27/distill' },
  ];
  const ranked = rankItems(items, 'dev', (item) => [item.name, item.repo]);
  assert.equal(ranked[0].name, 'dev-deck');
  assert.ok(!ranked.some((item) => item.name === 'synapse-web'));
  assert.deepEqual(
    rankItems(items, '', (item) => [item.name]).map((item) => item.name),
    items.map((item) => item.name),
  );
});
