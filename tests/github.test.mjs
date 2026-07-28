import test from 'node:test';
import assert from 'node:assert/strict';

import { encodePath, encodeBase64, decodeBase64 } from '../lib/github.js';
import { scrub, ApiError, missingToken } from '../lib/errors.js';

test('encodePath escapes segments but keeps the path structure', () => {
  assert.equal(encodePath('src/components/My File.js'), 'src/components/My%20File.js');
  assert.equal(encodePath('a/b/c.js'), 'a/b/c.js');
  assert.equal(encodePath('/leading/slash.js'), 'leading/slash.js');
  assert.equal(encodePath('weird name/#hash?.md'), 'weird%20name/%23hash%3F.md');
});

test('base64 round-trips UTF-8 content without corruption', () => {
  const source = 'const greeting = "héllo → 🌍";\nsecond line\n';
  assert.equal(decodeBase64(encodeBase64(source)), source);
});

test('decodeBase64 tolerates the newlines GitHub wraps content in', () => {
  assert.equal(decodeBase64('aGVs\nbG8=\n'), 'hello');
});

test('encodeBase64 handles empty content', () => {
  assert.equal(encodeBase64(''), '');
  assert.equal(decodeBase64(''), '');
});

test('scrub removes configured secrets from any string', () => {
  const previous = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'ghp_supersecretvalue';
  try {
    assert.equal(scrub('request failed with ghp_supersecretvalue'), 'request failed with [redacted]');
  } finally {
    if (previous === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previous;
  }
});

test('scrub ignores short or unset values so it cannot mangle normal text', () => {
  const previous = process.env.VERCEL_TEAM_ID;
  process.env.VERCEL_TEAM_ID = 'abc';
  try {
    assert.equal(scrub('abc is a normal word fragment'), 'abc is a normal word fragment');
  } finally {
    if (previous === undefined) delete process.env.VERCEL_TEAM_ID;
    else process.env.VERCEL_TEAM_ID = previous;
  }
});

test('ApiError carries the fields the client branches on', () => {
  const error = new ApiError('boom', { status: 429, code: 'rate_limited', service: 'github', hint: 'wait' });
  assert.equal(error.status, 429);
  assert.equal(error.code, 'rate_limited');
  assert.equal(error.service, 'github');
  assert.equal(error.hint, 'wait');
});

test('missingToken produces the code that triggers the setup guide', () => {
  const error = missingToken('vercel', 'VERCEL_TOKEN');
  assert.equal(error.code, 'missing_token');
  assert.equal(error.status, 401);
  assert.match(error.hint, /\.env\.local/);
});
