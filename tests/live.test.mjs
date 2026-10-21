/**
 * The live provider against a mocked fetch — dummy tokens, no network. Pins
 * the behaviour that moved out of the route handlers: the 409 mapping, the
 * 1 MB and binary limits, the repo-less redeploy, and the one-call activity feed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createLiveSource } from '../lib/source/live.js';
import { encodeBase64 } from '../lib/github.js';

const DUMMY = { VERCEL_TOKEN: 'dummy_vercel_token_123', GITHUB_TOKEN: 'dummy_github_token_456' };

async function withMockedFetch(handler, run) {
  const saved = { fetch: globalThis.fetch, env: { ...process.env } };
  const calls = [];
  Object.assign(process.env, DUMMY);
  delete process.env.VERCEL_TEAM_ID;
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: new URL(String(url)), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null };
    calls.push(call);
    const { status = 200, body = {} } = handler(call) || {};
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
  try {
    await run(createLiveSource(), calls);
  } finally {
    globalThis.fetch = saved.fetch;
    for (const key of Object.keys(DUMMY)) {
      if (saved.env[key] === undefined) delete process.env[key];
      else process.env[key] = saved.env[key];
    }
  }
}

test('listActivity is one /v6/deployments call without a projectId', async () => {
  await withMockedFetch(
    () => ({
      body: {
        deployments: [
          { uid: 'dpl_1', name: 'site', projectId: 'prj_1', state: 'READY', created: 2, buildingAt: 1, ready: 61001, meta: {} },
        ],
      },
    }),
    async (source, calls) => {
      const activity = await source.listActivity();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url.pathname, '/v6/deployments');
      assert.equal(calls[0].url.searchParams.get('limit'), '100');
      assert.equal(calls[0].url.searchParams.has('projectId'), false);
      assert.equal(activity[0].projectId, 'prj_1');
      assert.equal(activity[0].projectName, 'site');
      assert.equal(activity[0].durationMs, 61000);
    },
  );
});

test('putFile maps a GitHub 409 to the conflict error and base64-encodes content', async () => {
  await withMockedFetch(
    () => ({ status: 409, body: { message: 'README.md does not match abc' } }),
    async (source, calls) => {
      await assert.rejects(
        source.putFile({ owner: 'o', repo: 'r', path: 'README.md', branch: 'main', message: 'm', content: 'héllo', sha: 'abc' }),
        (error) => error.status === 409 && error.code === 'conflict' && /Reload the file/.test(error.hint),
      );
      assert.equal(calls[0].method, 'PUT');
      assert.equal(calls[0].body.content, encodeBase64('héllo'));
      assert.equal(calls[0].body.sha, 'abc');
    },
  );
});

test('getFile enforces the 1 MB limit and withholds binary content', async () => {
  await withMockedFetch(
    ({ url }) =>
      url.pathname.endsWith('big.bin')
        ? { body: { path: 'big.bin', size: 2 * 1024 * 1024, content: '' } }
        : { body: { path: 'logo.png', sha: 's1', size: 4, content: Buffer.from([0x89, 0, 1, 2]).toString('base64') } },
    async (source) => {
      await assert.rejects(source.getFile('o', 'r', 'big.bin'), (error) => error.status === 413);
      const file = await source.getFile('o', 'r', 'logo.png');
      assert.equal(file.binary, true);
      assert.equal(file.content, '');
    },
  );
});

test('redeploy refuses a project without a GitHub link', async () => {
  await withMockedFetch(
    () => ({ body: { id: 'prj_1', name: 'x', link: { type: 'gitlab' } } }),
    async (source, calls) => {
      await assert.rejects(source.redeploy('prj_1'), (error) => error.status === 400 && error.service === 'vercel');
      assert.equal(calls.length, 1, 'no deployment is created');
    },
  );
});

test('missing tokens still surface as missing_token for the setup guide', async () => {
  const saved = process.env.VERCEL_TOKEN;
  delete process.env.VERCEL_TOKEN;
  try {
    await assert.rejects(createLiveSource().listProjects(), (error) => error.code === 'missing_token');
  } finally {
    if (saved !== undefined) process.env.VERCEL_TOKEN = saved;
  }
});
