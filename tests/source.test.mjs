import test from 'node:test';
import assert from 'node:assert/strict';

import { SOURCE_METHODS, getSource, resolveMode } from '../lib/source/index.js';
import { readCookie } from '../lib/source/mode.js';
import { createDemoSource } from '../lib/source/demo/index.js';
import { createLiveSource } from '../lib/source/live.js';

const TOKENS = { VERCEL_TOKEN: 'dummy_vercel_token_123', GITHUB_TOKEN: 'dummy_github_token_456' };

function request(cookie) {
  return new Request('http://localhost/api/vercel/projects', { headers: cookie ? { cookie } : {} });
}

const MATRIX = [
  { name: 'DEVDECK_DEMO=1 with tokens', env: { DEVDECK_DEMO: '1', ...TOKENS }, cookie: null, mode: 'demo' },
  { name: 'DEVDECK_DEMO=1 without tokens', env: { DEVDECK_DEMO: '1' }, cookie: null, mode: 'demo' },
  { name: 'DEVDECK_DEMO=1 ignores a cookie', env: { DEVDECK_DEMO: '1', ...TOKENS }, cookie: 'devdeck_demo=0', mode: 'demo' },
  { name: 'no tokens, no cookie', env: {}, cookie: null, mode: 'live' },
  { name: 'no tokens + demo cookie', env: {}, cookie: 'theme=dark; devdeck_demo=1', mode: 'demo' },
  { name: 'tokens + demo cookie', env: TOKENS, cookie: 'devdeck_demo=1', mode: 'live' },
  { name: 'one token + demo cookie', env: { GITHUB_TOKEN: TOKENS.GITHUB_TOKEN }, cookie: 'devdeck_demo=1', mode: 'live' },
  { name: 'cookie with another value', env: {}, cookie: 'devdeck_demo=nope', mode: 'live' },
  { name: 'DEVDECK_DEMO=0 is not demo', env: { DEVDECK_DEMO: '0' }, cookie: null, mode: 'live' },
];

for (const row of MATRIX) {
  test(`getSource mode: ${row.name} → ${row.mode}`, () => {
    const source = getSource(request(row.cookie), { env: row.env });
    assert.equal(source.mode, row.mode);
    assert.equal(resolveMode({ env: row.env, cookieHeader: row.cookie }).mode, row.mode);
  });
}

test('resolveMode reports whether demo is forced and whether the toggle is available', () => {
  assert.deepEqual(resolveMode({ env: { DEVDECK_DEMO: '1' } }), { mode: 'demo', forced: true, available: true, reason: 'env' });
  assert.deepEqual(resolveMode({ env: TOKENS }), { mode: 'live', forced: false, available: false, reason: 'tokens' });
  assert.deepEqual(resolveMode({ env: {}, cookieHeader: 'devdeck_demo=1' }), { mode: 'demo', forced: false, available: true, reason: 'cookie' });
  assert.deepEqual(resolveMode({ env: {} }), { mode: 'live', forced: false, available: true, reason: 'default' });
});

test('readCookie finds one cookie among many', () => {
  assert.equal(readCookie('a=1; devdeck_demo=1; b=2', 'devdeck_demo'), '1');
  assert.equal(readCookie('xdevdeck_demo=1', 'devdeck_demo'), null);
  assert.equal(readCookie(null, 'devdeck_demo'), null);
});

test('both providers implement the full interface', () => {
  for (const source of [createLiveSource(), createDemoSource()]) {
    for (const method of SOURCE_METHODS) assert.equal(typeof source[method], 'function', `${source.mode}.${method}`);
  }
  assert.equal(createLiveSource().mode, 'live');
  assert.equal(createDemoSource().mode, 'demo');
});
