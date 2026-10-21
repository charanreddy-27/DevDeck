/**
 * The demo's time model.
 *
 * Nothing here stores a timestamp. Every deployment is an *offset* from an
 * anchor, and the anchor is "now" rounded down to the current build cycle:
 *
 *   anchor = floor(now / CYCLE_MS) * CYCLE_MS
 *
 * So within a cycle every request sees identical data (polling is stable,
 * React keys don't churn), and across cycles the whole history slides
 * forward with the clock — the newest deploy is always "25m ago", never
 * "8 months ago", however long the demo has been running.
 *
 * One project (scenario 'building') also gets a deployment per cycle whose
 * state is a pure function of the wall clock: QUEUED for QUEUE_MS, BUILDING
 * for BUILD_MS, then READY until the next cycle starts a fresh one. That
 * keeps a live build — and a growing, live-tailing log — on screen forever.
 */
import { DEMO_AUTHOR, DEMO_OWNER, DEMO_TEAM_SLUG, DEPENDABOT_MESSAGES, PREVIEW_BRANCHES } from './catalog.js';
import { createRng } from './prng.js';

export const CYCLE_MS = 120000;
export const QUEUE_MS = 6000;
export const BUILD_MS = 90000;
export const HISTORY_LENGTH = 20;

const DURATIONS = {
  'nextjs-ts': [45000, 150000],
  'nextjs-js': [40000, 110000],
  vite: [30000, 70000],
  sveltekit: [40000, 95000],
  python: [30000, 60000],
};

export function anchorFor(now) {
  return Math.floor(now / CYCLE_MS) * CYCLE_MS;
}

export function projectIdFor(project) {
  return `prj_${createRng(`prj:${project.name}`).base62(28)}`;
}

export function repoIdFor(project) {
  return createRng(`repo:${project.name}`).int(600000000, 980000000);
}

function branchSlug(branch) {
  return branch.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

/** Builds the raw Vercel deployment shape that lib/normalize.js already understands. */
export function rawDeployment(project, fields) {
  const { uid, created, state, target, branch, message, sha, author, login, buildingAt, ready, urlSlug } = fields;
  const production = target === 'production';
  return {
    uid,
    name: project.name,
    projectId: projectIdFor(project),
    url: `${project.name}-${urlSlug}-${DEMO_TEAM_SLUG}.vercel.app`,
    created,
    createdAt: created,
    buildingAt: buildingAt ?? undefined,
    ready: ready ?? undefined,
    state,
    readyState: state,
    target: production ? 'production' : null,
    source: 'git',
    inspectorUrl: `https://vercel.com/${DEMO_TEAM_SLUG}/${project.name}/${uid.slice(4)}`,
    creator: { username: DEMO_OWNER },
    // Production deploys always carry the canonical alias — even a failed or
    // in-flight one — so a project's "Open site" link stays <name>.vercel.app,
    // which on Vercel keeps serving the last good build.
    alias: production
      ? [`${project.name}.vercel.app`, `${project.name}-git-main-${DEMO_TEAM_SLUG}.vercel.app`]
      : state === 'READY'
        ? [`${project.name}-git-${branchSlug(branch)}-${DEMO_TEAM_SLUG}.vercel.app`]
        : [],
    meta: {
      githubCommitMessage: message,
      githubCommitAuthorName: author,
      githubCommitAuthorLogin: login,
      githubCommitRef: branch,
      githubCommitSha: sha,
      githubOrg: DEMO_OWNER,
      githubRepo: project.name,
      githubRepoId: String(repoIdFor(project)),
    },
    // Private to the demo: what the build log generator needs. normalize.js
    // picks named fields, so this never reaches a response.
    demo: fields.demo,
  };
}

/**
 * The seeded history: HISTORY_LENGTH deployments, newest first, as offsets
 * back from the anchor.
 */
export function historyFor(project, anchor) {
  const walk = createRng(`history:${project.name}`);
  const [minDuration, maxDuration] = DURATIONS[project.stack];
  const nodeStack = project.stack !== 'python';
  const out = [];
  let offset = walk.range(...project.cadence.first);

  for (let index = 0; index < HISTORY_LENGTH; index += 1) {
    const rng = createRng(`deployment:${project.name}:${index}`);

    // The failing project's newest deploy is the broken production build;
    // the newest deploy is always production so the card reflects it.
    const production = index === 0 || rng.chance(0.58);
    const dependabot = !production && nodeStack && rng.chance(0.18);
    const branch = production
      ? 'main'
      : dependabot
        ? `dependabot/npm_and_yarn/${rng.pick(['next', 'eslint', 'vite', 'typescript'])}-${rng.int(1, 9)}.${rng.int(0, 12)}.${rng.int(0, 9)}`
        : rng.pick(PREVIEW_BRANCHES);

    const messages = project.messages;
    const message =
      project.scenario === 'failing' && index === 0
        ? messages[0]
        : dependabot
          ? rng.pick(DEPENDABOT_MESSAGES)
          : messages[(index + rng.int(0, messages.length - 1)) % messages.length];

    let state = 'READY';
    let failure = null;
    if (project.scenario === 'failing' && index === 0) {
      state = 'ERROR';
      failure = 'typescript';
    } else if (project.canceledAt === index) {
      state = 'CANCELED';
    } else if (index > 0 && rng.chance(0.07)) {
      state = 'ERROR';
    }

    // Mostly warm-cache builds, with the occasional slow cold one up to 240s.
    const planned = rng.chance(0.08) ? rng.range(170000, 240000) : rng.range(minDuration, maxDuration);
    const durationMs = Math.round(
      state === 'ERROR' ? Math.max(30000, planned * rng.range(0.45, 0.8)) : state === 'CANCELED' ? Math.max(30000, planned * 0.5) : planned,
    );

    const created = Math.round(anchor - offset);
    const buildingAt = created + rng.int(1500, 8000);

    out.push(
      rawDeployment(project, {
        uid: `dpl_${rng.base62(28)}`,
        created,
        buildingAt,
        ready: state === 'CANCELED' ? null : buildingAt + durationMs,
        state,
        target: production ? 'production' : 'preview',
        branch,
        message,
        sha: rng.hex(40),
        author: dependabot ? 'dependabot[bot]' : DEMO_AUTHOR,
        login: dependabot ? 'dependabot[bot]' : DEMO_OWNER,
        urlSlug: rng.slug(9),
        demo: { durationMs, outcome: state, failure },
      }),
    );

    offset += walk.range(...project.cadence.gap);
  }

  return out;
}

/** The scenario-'building' deployment for cycle k, with its state derived from `now`. */
export function cycleDeployment(project, k, now) {
  const rng = createRng(`cycle:${project.name}:${k}`);
  const created = k * CYCLE_MS;
  const elapsed = now - created;
  const state = elapsed < QUEUE_MS ? 'QUEUED' : elapsed < QUEUE_MS + BUILD_MS ? 'BUILDING' : 'READY';
  const buildingAt = state === 'QUEUED' ? null : created + QUEUE_MS;
  const pool = project.cycleMessages || project.messages;

  return rawDeployment(project, {
    uid: `dpl_${rng.base62(28)}`,
    created,
    buildingAt,
    ready: state === 'READY' ? created + QUEUE_MS + BUILD_MS : null,
    state,
    target: 'production',
    branch: 'main',
    message: pool[((k % pool.length) + pool.length) % pool.length],
    sha: rng.hex(40),
    author: DEMO_AUTHOR,
    login: DEMO_OWNER,
    urlSlug: rng.slug(9),
    demo: {
      durationMs: BUILD_MS,
      outcome: 'READY',
      failure: null,
      // Elapsed build time; null while queued (no log yet).
      elapsedMs: state === 'QUEUED' ? null : Math.min(elapsed - QUEUE_MS, BUILD_MS),
    },
  });
}

/** The current and previous cycle — the previous one is the READY deploy just before the live one. */
export function cycleDeployments(project, now) {
  if (project.scenario !== 'building') return [];
  const k = Math.floor(now / CYCLE_MS);
  return [cycleDeployment(project, k, now), cycleDeployment(project, k - 1, now)];
}
