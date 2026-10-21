import test from 'node:test';
import assert from 'node:assert/strict';

import { createDemoSource } from '../lib/source/demo/index.js';
import { createStore, MAX_WRITES } from '../lib/source/demo/store.js';
import { BUILD_MS, CYCLE_MS, QUEUE_MS } from '../lib/source/demo/history.js';
import { blobSha } from '../lib/source/demo/repos.js';
import { conflictError } from '../lib/github.js';

// A cycle-aligned instant (midnight UTC is a multiple of the 2-minute cycle).
const T0 = Date.UTC(2026, 9, 20, 12, 0, 0);
const OWNER = 'charanreddy-27';

function demoAt(now, store = createStore()) {
  const clock = { now };
  const source = createDemoSource({ clock: () => clock.now, store });
  return { source, clock, store };
}

async function projectNamed(source, name) {
  const { projects } = await source.listProjects();
  return projects.find((project) => project.name === name);
}

test('demo data is deterministic for the same clock', async () => {
  const a = demoAt(T0 + 37000).source;
  const b = demoAt(T0 + 37000).source;

  assert.deepEqual(await a.listProjects(), await b.listProjects());
  const { projects } = await a.listProjects();
  for (const project of projects) {
    const left = await a.listDeployments(project.id);
    assert.deepEqual(left, await b.listDeployments(project.id));
    assert.deepEqual(await a.getLogs(left[1].id), await b.getLogs(left[1].id));
  }
  assert.deepEqual(await a.getTree(OWNER, 'forge'), await b.getTree(OWNER, 'forge'));
  assert.deepEqual(await a.listActivity(), await b.listActivity());
  assert.deepEqual(await a.listCommits(OWNER, 'dev-deck'), await b.listCommits(OWNER, 'dev-deck'));
});

test('the demo portfolio looks like a real account', async () => {
  // 30s into a cycle, so the building project is mid-build.
  const { source } = demoAt(T0 + 30000);
  const { projects, teamScoped } = await source.listProjects();

  assert.equal(projects.length, 10);
  assert.equal(teamScoped, false);
  for (const project of projects) {
    assert.match(project.id, /^prj_[A-Za-z0-9]{28}$/);
    assert.equal(project.repo.owner, OWNER);
    assert.equal(project.repo.branch, 'main');
    assert.equal(project.productionUrl, `https://${project.name}.vercel.app`);
  }

  const frameworks = Object.fromEntries(projects.map((project) => [project.name, project.framework]));
  assert.equal(frameworks['dev-deck'], 'nextjs');
  assert.equal(frameworks.distill, 'vite');
  assert.equal(frameworks.tracewave, 'sveltekit');
  assert.equal(frameworks.gauntlet, null);

  // Newest deploy first, like the live provider.
  const times = projects.map((project) => project.lastDeployedAt);
  assert.deepEqual(times, times.slice().sort((x, y) => y - x));

  // Every state the UI renders appears somewhere.
  const states = new Set();
  let production = 0;
  let preview = 0;
  for (const project of projects) {
    const deployments = await source.listDeployments(project.id);
    assert.ok(deployments.length >= 20, `${project.name} has ${deployments.length} deployments`);
    for (const deployment of deployments) {
      states.add(deployment.state);
      if (deployment.target === 'production') production += 1;
      else preview += 1;
      if (deployment.state === 'READY' && deployment.durationMs) {
        assert.ok(deployment.durationMs >= 30000 && deployment.durationMs <= 240000, `duration ${deployment.durationMs}`);
      }
    }
  }
  for (const state of ['READY', 'ERROR', 'CANCELED', 'BUILDING']) assert.ok(states.has(state), `missing ${state}`);
  assert.ok(production > 0 && preview > 0);

  const synapse = projects.find((project) => project.name === 'synapse-web');
  assert.equal(synapse.status, 'ERROR');
});

test('the building project cycles QUEUED → BUILDING → READY with the wall clock', async () => {
  const states = [];
  const ids = [];
  for (const offset of [1000, QUEUE_MS + 1000, QUEUE_MS + BUILD_MS / 2, QUEUE_MS + BUILD_MS + 1000, CYCLE_MS + 1000]) {
    const { source } = demoAt(T0 + offset);
    const forge = await projectNamed(source, 'forge');
    const [latest] = await source.listDeployments(forge.id);
    states.push([forge.status, latest.state]);
    ids.push(latest.id);
  }

  assert.deepEqual(states, [
    ['QUEUED', 'QUEUED'],
    ['BUILDING', 'BUILDING'],
    ['BUILDING', 'BUILDING'],
    ['READY', 'READY'],
    ['QUEUED', 'QUEUED'],
  ]);
  // Same deployment within a cycle, a fresh one in the next.
  assert.equal(new Set(ids.slice(0, 4)).size, 1);
  assert.notEqual(ids[4], ids[0]);

  // The finished cycle build shows up as the previous READY deploy.
  const { source } = demoAt(T0 + CYCLE_MS + 1000);
  const forge = await projectNamed(source, 'forge');
  const [, previous] = await source.listDeployments(forge.id);
  assert.equal(previous.id, ids[0]);
  assert.equal(previous.state, 'READY');
  assert.equal(previous.durationMs, BUILD_MS);
});

test('history slides with the clock, so relative times always look fresh', async () => {
  const early = demoAt(T0).source;
  const later = demoAt(T0 + 40 * 86400000).source;

  const a = await projectNamed(early, 'dev-deck');
  const b = await projectNamed(later, 'dev-deck');
  assert.equal(a.id, b.id);
  assert.equal(T0 - a.lastDeployedAt, T0 + 40 * 86400000 - b.lastDeployedAt);

  const [first] = await early.listDeployments(a.id);
  const [second] = await later.listDeployments(b.id);
  assert.equal(first.id, second.id, 'deployment ids are stable across cycles');
});

test('a running build log grows with elapsed time and is shaped like parseLogLines output', async () => {
  const counts = [];
  let finalLines = null;
  for (const offset of [2000, QUEUE_MS + 10000, QUEUE_MS + 45000, QUEUE_MS + BUILD_MS + 5000]) {
    const { source } = demoAt(T0 + offset);
    const forge = await projectNamed(source, 'forge');
    const [latest] = await source.listDeployments(forge.id);
    const { lines, truncated } = await source.getLogs(latest.id);
    assert.equal(truncated, false);
    counts.push(lines.length);
    finalLines = lines;
  }

  assert.equal(counts[0], 0, 'nothing logged while queued');
  assert.ok(counts[1] > 0 && counts[1] < counts[2] && counts[2] < counts[3], `counts ${counts}`);

  for (const line of finalLines) {
    assert.deepEqual(Object.keys(line).sort(), ['created', 'id', 'level', 'text', 'type']);
    assert.ok(['info', 'warn', 'error'].includes(line.level));
  }
  const text = finalLines.map((line) => line.text).join('\n');
  assert.match(text, /Cloning github\.com\/charanreddy-27\/forge/);
  assert.match(text, /Running "npm run build"/);
  assert.match(text, /Route \(app\)/);
  assert.match(text, /Build Completed in \/vercel\/output/);
  assert.match(text, /Deploying outputs/);
  assert.equal(new Set(finalLines.map((line) => line.id)).size, finalLines.length);
});

test('the failing project has a realistic TypeScript build failure', async () => {
  const { source } = demoAt(T0);
  const synapse = await projectNamed(source, 'synapse-web');
  const [latest] = await source.listDeployments(synapse.id);
  assert.equal(latest.state, 'ERROR');
  assert.equal(latest.target, 'production');

  const { lines } = await source.getLogs(latest.id);
  const errors = lines.filter((line) => line.level === 'error').map((line) => line.text);
  assert.ok(errors.some((text) => text.startsWith('Type error:')));
  assert.ok(errors.some((text) => text.includes('exited with 1')));
});

test('putFile commits: new sha, new commit, new building deployment that turns READY', async () => {
  const { source, clock } = demoAt(T0 + 30000);
  const before = await source.getFile(OWNER, 'dev-deck', 'README.md');
  assert.equal(before.sha, blobSha(before.content));

  const content = `${before.content}\nEdited from the demo.\n`;
  const result = await source.putFile({
    owner: OWNER,
    repo: 'dev-deck',
    path: 'README.md',
    branch: 'main',
    message: 'Tweak README',
    content,
    sha: before.sha,
  });

  assert.notEqual(result.file.sha, before.sha);
  assert.equal(result.file.sha, blobSha(content));
  assert.match(result.commit.sha, /^[0-9a-f]{40}$/);
  assert.equal(result.commit.message, 'Tweak README');

  const after = await source.getFile(OWNER, 'dev-deck', 'README.md');
  assert.equal(after.content, content);
  assert.equal(after.sha, result.file.sha);

  const tree = await source.getTree(OWNER, 'dev-deck');
  assert.equal(tree.files.find((file) => file.path === 'README.md').sha, result.file.sha);

  const [commit] = await source.listCommits(OWNER, 'dev-deck');
  assert.equal(commit.sha, result.commit.sha);
  assert.equal(commit.message, 'Tweak README');

  const project = await projectNamed(source, 'dev-deck');
  clock.now += 5000;
  let [deployment] = await source.listDeployments(project.id);
  assert.equal(deployment.state, 'BUILDING');
  assert.equal(deployment.commitSha, result.commit.sha);
  assert.equal((await projectNamed(source, 'dev-deck')).status, 'BUILDING');

  clock.now += 41000;
  [deployment] = await source.listDeployments(project.id);
  assert.equal(deployment.state, 'READY');
  assert.equal((await projectNamed(source, 'dev-deck')).status, 'READY');
});

test('a stale sha is rejected with the same 409 conflict as live', async () => {
  const { source } = demoAt(T0);
  const file = await source.getFile(OWNER, 'forge', 'package.json');
  await source.putFile({ owner: OWNER, repo: 'forge', path: 'package.json', message: 'one', content: '{}\n', sha: file.sha });

  await assert.rejects(
    source.putFile({ owner: OWNER, repo: 'forge', path: 'package.json', message: 'two', content: '[]\n', sha: file.sha }),
    (error) => {
      const live = conflictError();
      assert.equal(error.status, 409);
      assert.equal(error.code, 'conflict');
      assert.equal(error.service, 'github');
      assert.equal(error.hint, live.hint);
      return true;
    },
  );
});

test('redeploy simulates QUEUED → BUILDING → READY', async () => {
  const { source, clock } = demoAt(T0 + 20000);
  const project = await projectNamed(source, 'distill');
  const result = await source.redeploy(project.id);
  assert.equal(result.state, 'QUEUED');
  assert.equal(result.branch, 'main');

  const stateAt = async (delta) => {
    clock.now = T0 + 20000 + delta;
    const deployments = await source.listDeployments(project.id);
    return deployments.find((deployment) => deployment.id === result.id).state;
  };
  assert.equal(await stateAt(1000), 'QUEUED');
  assert.equal(await stateAt(20000), 'BUILDING');
  assert.equal(await stateAt(46000), 'READY');
});

test('fixing the scripted bug in synapse-web makes its next build pass', async () => {
  const { source, clock } = demoAt(T0);
  const synapse = await projectNamed(source, 'synapse-web');

  // An unrelated commit still fails: the bug is still there.
  const readme = await source.getFile(OWNER, 'synapse-web', 'README.md');
  await source.putFile({ owner: OWNER, repo: 'synapse-web', path: 'README.md', message: 'docs', content: `${readme.content}.\n`, sha: readme.sha });
  clock.now += 46000;
  assert.equal((await source.listDeployments(synapse.id))[0].state, 'ERROR');

  const page = await source.getFile(OWNER, 'synapse-web', 'app/graph/[nodeId]/page.tsx');
  const fixed = page.content.replace('cosine(node.embedding, query)', 'cosine(node.embeddings[0], query)');
  assert.notEqual(fixed, page.content);
  await source.putFile({ owner: OWNER, repo: 'synapse-web', path: page.path, message: 'Read embeddings', content: fixed, sha: page.sha });

  clock.now += 46000;
  const [latest] = await source.listDeployments(synapse.id);
  assert.equal(latest.state, 'READY');
  assert.equal((await projectNamed(source, 'synapse-web')).status, 'READY');
});

test('simulated writes are capped in memory', async () => {
  const store = createStore();
  const { source } = demoAt(T0, store);
  for (let i = 0; i < MAX_WRITES + 15; i += 1) {
    const file = await source.getFile(OWNER, 'tracewave', 'README.md');
    await source.putFile({ owner: OWNER, repo: 'tracewave', path: 'README.md', message: `edit ${i}`, content: `v${i}\n`, sha: file.sha });
  }
  assert.equal(store.size, MAX_WRITES);
  assert.equal((await source.getFile(OWNER, 'tracewave', 'README.md')).content, `v${MAX_WRITES + 14}\n`);
});

test('demo repos respect the editor limits and response shapes', async () => {
  const { source } = demoAt(T0);

  const tree = await source.getTree(OWNER, 'vantis-website');
  assert.equal(tree.branch, 'main');
  assert.equal(tree.defaultBranch, 'main');
  assert.equal(tree.truncated, false);
  assert.equal(tree.repo.owner, OWNER);
  for (const file of tree.files) assert.deepEqual(Object.keys(file).sort(), ['path', 'sha', 'size', 'tooLarge']);
  assert.equal(tree.files.find((file) => file.path === 'public/hero.mp4').tooLarge, true);

  await assert.rejects(source.getFile(OWNER, 'vantis-website', 'public/hero.mp4'), (error) => error.status === 413);
  await assert.rejects(source.getFile(OWNER, 'vantis-website', 'app'), (error) => error.status === 400);
  await assert.rejects(source.getFile(OWNER, 'nope', 'README.md'), (error) => error.status === 404 && error.code === 'not_found');
  await assert.rejects(source.getTree('someone-else', 'forge'), (error) => error.status === 404);

  const icon = await source.getFile(OWNER, 'vantis-website', 'public/favicon.ico');
  assert.equal(icon.binary, true);
  assert.equal(icon.content, '');

  const pyproject = await source.getFile(OWNER, 'gauntlet', 'pyproject.toml');
  assert.match(pyproject.content, /\[project\]/);
  assert.deepEqual(Object.keys(pyproject).sort(), ['binary', 'content', 'path', 'sha', 'size', 'url']);

  await assert.rejects(source.listDeployments('prj_missing'), (error) => error.status === 404 && error.service === 'vercel');
  await assert.rejects(source.getLogs('dpl_missing'), (error) => error.status === 404);
});

test('the demo provider never touches the network', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('network access in demo mode');
  };
  try {
    const { source } = demoAt(T0 + 50000);
    const { projects } = await source.listProjects();
    await source.listActivity();
    for (const project of projects.slice(0, 3)) {
      const [deployment] = await source.listDeployments(project.id);
      await source.getLogs(deployment.id);
      await source.getTree(OWNER, project.name);
      await source.listCommits(OWNER, project.name);
      await source.redeploy(project.id);
    }
  } finally {
    globalThis.fetch = original;
  }
});
