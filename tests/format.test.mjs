import test from 'node:test';
import assert from 'node:assert/strict';

import {
  relativeTime,
  formatDuration,
  formatBytes,
  shortSha,
  hostOf,
  vercelProjectUrl,
  cx,
} from '../lib/format.js';

test('relativeTime renders compact ages', () => {
  assert.equal(relativeTime(Date.now() - 3000), 'just now');
  assert.equal(relativeTime(Date.now() - 50 * 1000), '50s ago');
  assert.equal(relativeTime(Date.now() - 50 * 60 * 1000), '50m ago');
  assert.equal(relativeTime(Date.now() - 2 * 3600 * 1000), '2h ago');
  assert.equal(relativeTime(Date.now() - 2 * 86400 * 1000), '2d ago');
  assert.equal(relativeTime(null), '—');
});

test('relativeTime accepts ISO strings and Date objects', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
  assert.equal(relativeTime(twoHoursAgo), '2h ago');
  assert.equal(relativeTime(twoHoursAgo.toISOString()), '2h ago');
  assert.equal(relativeTime('not a date'), '—');
});

test('formatDuration reads like a build time', () => {
  assert.equal(formatDuration(45000), '45s');
  assert.equal(formatDuration(72000), '1m 12s');
  assert.equal(formatDuration(120000), '2m');
  assert.equal(formatDuration(0), null);
  assert.equal(formatDuration(null), null);
});

test('formatBytes switches units', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(3 * 1024 * 1024), '3.0 MB');
});

test('shortSha and hostOf trim values for display', () => {
  assert.equal(shortSha('abcdef1234567890'), 'abcdef1');
  assert.equal(shortSha(null), '');
  assert.equal(hostOf('https://my-site.com/deep/path'), 'my-site.com');
  assert.equal(hostOf(null), '');
});

test('vercelProjectUrl derives the dashboard link from an inspector URL', () => {
  assert.equal(
    vercelProjectUrl('https://vercel.com/acme/my-site/dpl_1'),
    'https://vercel.com/acme/my-site',
  );
  assert.equal(vercelProjectUrl(null), null);
  assert.equal(vercelProjectUrl('not-a-url'), null);
});

test('cx drops falsy class names', () => {
  assert.equal(cx('a', false, null, 'b', undefined), 'a b');
});
