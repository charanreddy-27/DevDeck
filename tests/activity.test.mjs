import test from 'node:test';
import assert from 'node:assert/strict';

import { median, summarizeActivity } from '../lib/activity.js';
import { createDemoSource } from '../lib/source/demo/index.js';
import { createStore } from '../lib/source/demo/store.js';

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const HOUR = 3600000;

function deployment(state, hoursAgo, extra = {}) {
  return { state, created: NOW - hoursAgo * HOUR, durationMs: null, projectId: 'prj_a', projectName: 'a', ...extra };
}

test('median handles odd, even and empty inputs', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 3);
  assert.equal(median([null, undefined]), null);
  assert.equal(median([]), null);
});

test('summarizeActivity buckets by UTC day and computes rates', () => {
  const summary = summarizeActivity(
    [
      deployment('READY', 1, { durationMs: 60000 }),
      deployment('READY', 2, { durationMs: 120000 }),
      deployment('ERROR', 3, { durationMs: 30000 }),
      deployment('CANCELED', 30),
      deployment('BUILDING', 0.1, { projectId: 'prj_b', projectName: 'b' }),
      deployment('READY', 24 * 20, { durationMs: 90000 }), // outside the 14-day window
    ],
    { now: NOW, days: 14 },
  );

  assert.equal(summary.total, 6);
  assert.equal(summary.inFlight, 1);
  // 3 READY vs 1 ERROR; canceled and building count as neither.
  assert.equal(summary.successRate, 0.75);
  assert.equal(summary.medianBuildMs, 90000);

  assert.equal(summary.byDay.length, 14);
  assert.equal(summary.byDay.at(-1).date, '2026-10-20');
  assert.deepEqual(summary.byDay.at(-1), { date: '2026-10-20', total: 4, ready: 2, error: 1, canceled: 0 });
  assert.deepEqual(summary.byDay.at(-2), { date: '2026-10-19', total: 1, ready: 0, error: 0, canceled: 1 });

  // Newest first per project.
  assert.deepEqual(summary.byProject.prj_a.recent, ['READY', 'READY', 'ERROR', 'CANCELED', 'READY']);
  assert.deepEqual(summary.byProject.prj_b, { projectId: 'prj_b', name: 'b', recent: ['BUILDING'] });
});

test('summarizeActivity survives an empty list', () => {
  const summary = summarizeActivity([], { now: NOW });
  assert.equal(summary.total, 0);
  assert.equal(summary.successRate, null);
  assert.equal(summary.medianBuildMs, null);
  assert.equal(summary.byDay.length, 14);
  assert.deepEqual(summary.byProject, {});
});

test('demo listActivity spans every project, newest first, tagged with the project', async () => {
  const source = createDemoSource({ clock: () => NOW + 30000, store: createStore() });
  const activity = await source.listActivity();

  assert.equal(activity.length, 100);
  const created = activity.map((item) => item.created);
  assert.deepEqual(created, created.slice().sort((a, b) => b - a));
  for (const item of activity) {
    assert.match(item.projectId, /^prj_/);
    assert.equal(typeof item.projectName, 'string');
    assert.ok(item.id && item.state);
  }
  assert.ok(new Set(activity.map((item) => item.projectName)).size >= 8);

  const summary = summarizeActivity(activity, { now: NOW });
  assert.ok(summary.successRate > 0.7 && summary.successRate < 1);
  assert.ok(summary.medianBuildMs >= 30000 && summary.medianBuildMs <= 240000);
  assert.ok(summary.byDay.reduce((total, day) => total + day.total, 0) > 50);
});
