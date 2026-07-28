import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeProject,
  normalizeDeployment,
  normalizeCommit,
  normalizeState,
} from '../lib/normalize.js';

test('normalizeState folds Vercel states into the four the UI renders', () => {
  assert.equal(normalizeState('READY'), 'READY');
  assert.equal(normalizeState('INITIALIZING'), 'BUILDING');
  assert.equal(normalizeState('DEPLOYING'), 'BUILDING');
  assert.equal(normalizeState('QUEUED'), 'QUEUED');
  assert.equal(normalizeState('CANCELLED'), 'CANCELED');
  assert.equal(normalizeState('ERROR'), 'ERROR');
  assert.equal(normalizeState(undefined), 'NONE');
});

test('normalizeProject reads the production target', () => {
  const project = normalizeProject({
    id: 'prj_abc',
    name: 'my-site',
    framework: 'nextjs',
    link: { type: 'github', org: 'acme', repo: 'my-site', repoId: 12345, productionBranch: 'main' },
    targets: {
      production: {
        id: 'dpl_1',
        readyState: 'READY',
        createdAt: 1700000000000,
        url: 'my-site-abc123.vercel.app',
        alias: ['my-site-git-main-acme.vercel.app', 'my-site.com'],
        meta: { githubCommitMessage: 'Fix nav spacing\n\nlonger body' },
      },
    },
  });

  assert.equal(project.status, 'READY');
  assert.equal(project.lastDeployedAt, 1700000000000);
  // The shortest alias is the canonical domain, not the git-branch alias.
  assert.equal(project.productionUrl, 'https://my-site.com');
  // Only the commit subject belongs on a card.
  assert.equal(project.commitMessage, 'Fix nav spacing');
  assert.deepEqual(project.repo, {
    owner: 'acme',
    name: 'my-site',
    repoId: 12345,
    branch: 'main',
    url: 'https://github.com/acme/my-site',
  });
});

test('normalizeProject falls back to latestDeployments when there is no target', () => {
  const project = normalizeProject({
    id: 'prj_2',
    name: 'old',
    latestDeployments: [
      { uid: 'd2', state: 'BUILDING', created: 1700000001000, url: 'old.vercel.app', target: 'production' },
    ],
  });

  assert.equal(project.status, 'BUILDING');
  assert.equal(project.productionUrl, 'https://old.vercel.app');
});

test('normalizeProject reports non-GitHub providers without a repo', () => {
  const project = normalizeProject({
    id: 'prj_3',
    name: 'gl',
    link: { type: 'gitlab', org: 'x', repo: 'y' },
  });

  assert.equal(project.repo, null);
  assert.equal(project.gitProvider, 'gitlab');
});

test('normalizeProject survives a project that has never deployed', () => {
  const project = normalizeProject({ id: 'p4', name: 'fresh' });

  assert.equal(project.status, 'NONE');
  assert.equal(project.lastDeployedAt, null);
  assert.equal(project.productionUrl, null);
  assert.equal(project.repo, null);
});

test('normalizeProject tolerates an empty payload', () => {
  const project = normalizeProject({});
  assert.equal(project.name, 'unnamed');
  assert.equal(project.status, 'NONE');
});

test('normalizeDeployment pulls commit metadata and build duration', () => {
  const deployment = normalizeDeployment({
    uid: 'dpl_9',
    state: 'READY',
    created: 1700000000000,
    buildingAt: 1700000000000,
    ready: 1700000072000,
    url: 'x-123.vercel.app',
    target: 'production',
    meta: {
      githubCommitMessage: 'Add API route',
      githubCommitAuthorName: 'Ada',
      githubCommitRef: 'main',
      githubCommitSha: 'abcdef1234567890',
    },
  });

  assert.equal(deployment.id, 'dpl_9');
  assert.equal(deployment.author, 'Ada');
  assert.equal(deployment.branch, 'main');
  assert.equal(deployment.durationMs, 72000);
  assert.equal(deployment.url, 'https://x-123.vercel.app');
});

test('normalizeDeployment leaves duration null when timings are missing', () => {
  const deployment = normalizeDeployment({ uid: 'd', state: 'QUEUED', created: 1 });
  assert.equal(deployment.durationMs, null);
  assert.equal(deployment.state, 'QUEUED');
  assert.equal(deployment.target, 'preview');
});

test('normalizeCommit keeps only the commit subject', () => {
  const commit = normalizeCommit({
    sha: 'aaaaaaabbbbbb',
    html_url: 'https://github.com/a/b/commit/aaa',
    commit: { message: 'Subject line\n\nBody text', author: { name: 'Grace', date: '2024-01-01T00:00:00Z' } },
    author: { avatar_url: 'https://avatars.example/x.png' },
  });

  assert.equal(commit.message, 'Subject line');
  assert.equal(commit.author, 'Grace');
  assert.equal(commit.avatar, 'https://avatars.example/x.png');
});
