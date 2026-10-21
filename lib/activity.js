/**
 * Aggregates a flat list of normalized deployments (from listActivity) into
 * the numbers an insights strip needs. Pure, so it is tested directly and
 * works identically on live and demo data.
 *
 * Days are bucketed in UTC: the server cannot know the viewer's timezone, and
 * the raw deployments ship alongside for any client that wants local buckets.
 */

const DAY_MS = 86400000;
const FINISHED = new Set(['READY', 'ERROR']);
const IN_FLIGHT = new Set(['BUILDING', 'QUEUED']);

function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * @param {Array<{ state: string, created: number, durationMs: number|null, projectId: string|null, projectName: string|null }>} deployments
 * @param {{ now?: number, days?: number, perProject?: number }} [options]
 */
export function summarizeActivity(deployments, { now = Date.now(), days = 14, perProject = 10 } = {}) {
  const list = (deployments || []).filter((d) => typeof d?.created === 'number').sort((a, b) => b.created - a.created);

  // Oldest first, so the array maps straight onto a left-to-right chart.
  const byDay = [];
  const index = new Map();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = utcDay(now - offset * DAY_MS);
    const bucket = { date, total: 0, ready: 0, error: 0, canceled: 0 };
    index.set(date, bucket);
    byDay.push(bucket);
  }

  const byProject = {};
  let ready = 0;
  let failed = 0;
  let inFlight = 0;

  for (const deployment of list) {
    const bucket = index.get(utcDay(deployment.created));
    if (bucket) {
      bucket.total += 1;
      if (deployment.state === 'READY') bucket.ready += 1;
      if (deployment.state === 'ERROR') bucket.error += 1;
      if (deployment.state === 'CANCELED') bucket.canceled += 1;
    }

    if (deployment.state === 'READY') ready += 1;
    if (deployment.state === 'ERROR') failed += 1;
    if (IN_FLIGHT.has(deployment.state)) inFlight += 1;

    const key = deployment.projectId || deployment.projectName;
    if (key) {
      byProject[key] ||= { projectId: deployment.projectId || null, name: deployment.projectName || null, recent: [] };
      // Newest first; the sparkline decides its own direction.
      if (byProject[key].recent.length < perProject) byProject[key].recent.push(deployment.state);
    }
  }

  const finished = list.filter((d) => FINISHED.has(d.state));

  return {
    total: list.length,
    inFlight,
    // Canceled and in-flight builds are neither a success nor a failure.
    successRate: ready + failed ? ready / (ready + failed) : null,
    medianBuildMs: median(finished.filter((d) => d.state === 'READY').map((d) => d.durationMs)),
    byDay,
    byProject,
  };
}
