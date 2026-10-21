/**
 * The demo provider: the same interface as the live one, answered entirely
 * from seeded data and an in-memory write store. It never touches the
 * network — there is no fetch anywhere in lib/source/demo — which is what
 * makes DEVDECK_DEMO=1 safe to put on a public URL.
 *
 * Raw payloads are built in Vercel's and GitHub's own shapes and passed
 * through the real normalizers and log parser, so a demo response can't
 * drift from a live one.
 */
import { createHash } from 'node:crypto';
import { ApiError, ERROR_CODES } from '../../errors.js';
import { conflictError } from '../../github.js';
import { parseLogLines } from '../../logs.js';
import { normalizeCommit, normalizeDeployment, normalizeProject } from '../../normalize.js';
import {
  ACTIVITY_LIMIT,
  MAX_EDITABLE_BYTES,
  MAX_LOG_LINES,
  directoryNotFile,
  fileTooLarge,
  sortProjects,
  toTreeFiles,
} from '../shared.js';
import { buildLogEvents } from './buildlog.js';
import { DEMO_AUTHOR, DEMO_OWNER, DEMO_PROJECTS } from './catalog.js';
import { CYCLE_MS, anchorFor, cycleDeployment, cycleDeployments, historyFor, projectIdFor, rawDeployment, repoIdFor } from './history.js';
import { createRng } from './prng.js';
import { blobSha, seedFiles } from './repos.js';
import {
  SIM_QUEUE_AFTER_COMMIT_MS,
  SIM_QUEUE_AFTER_REDEPLOY_MS,
  SIM_TOTAL_MS,
  defaultStore,
} from './store.js';

const AVATARS = {
  [DEMO_OWNER]: `https://avatars.githubusercontent.com/${DEMO_OWNER}?s=52`,
  'dependabot[bot]': 'https://avatars.githubusercontent.com/in/29110?s=52',
};

function vercelNotFound() {
  return new ApiError('Vercel could not find that resource.', {
    status: 404,
    code: ERROR_CODES.NOT_FOUND,
    service: 'vercel',
  });
}

function githubNotFound(detail) {
  return new ApiError(detail || 'GitHub could not find that repository, branch, or file.', {
    status: 404,
    code: ERROR_CODES.NOT_FOUND,
    service: 'github',
    hint: 'For private repositories, make sure the token has access to this specific repo.',
  });
}

function sha1(input) {
  return createHash('sha1').update(String(input)).digest('hex');
}

function findProject(idOrName) {
  // Vercel's /v9/projects/{idOrName} accepts either, so the demo does too.
  return DEMO_PROJECTS.find((project) => projectIdFor(project) === idOrName || project.name === idOrName) || null;
}

function findRepo(owner, repo) {
  if (String(owner).toLowerCase() !== DEMO_OWNER.toLowerCase()) return null;
  return DEMO_PROJECTS.find((project) => project.name.toLowerCase() === String(repo).toLowerCase()) || null;
}

/**
 * The scripted bug in synapse-web: its build fails until the page stops
 * reading `node.embedding` (or the type grows the field back). Checked
 * against the repo as it stands after demo writes, so fixing it in the
 * editor really does turn the next build green.
 */
function scriptedFailure(project, files) {
  if (project.scenario !== 'failing') return null;
  const page = files.get('app/graph/[nodeId]/page.tsx')?.content || '';
  const types = files.get('lib/types.ts')?.content || '';
  const stillBroken = /\.embedding\b(?!s)/.test(page) && !/\bembedding\s*[?]?:/.test(types);
  return stillBroken ? 'typescript' : null;
}

export function createDemoSource({ clock = Date.now, store = defaultStore } = {}) {
  /** Seed files with every recorded write applied, in order. */
  function filesFor(project) {
    const files = new Map(seedFiles(project));
    for (const write of store.all()) {
      if (write.kind !== 'commit' || write.projectName !== project.name) continue;
      files.set(write.path, { path: write.path, binary: false, content: write.content, size: write.size, sha: write.sha });
    }
    return files;
  }

  function simulatedDeployment(project, write, now) {
    const { uid, queueMs, target, branch, message, commitSha, outcome, failure, urlSlug } = write.deployment;
    const created = write.at;
    const buildMs = SIM_TOTAL_MS - queueMs;
    const elapsed = now - created;
    const state = elapsed < queueMs ? 'QUEUED' : elapsed < SIM_TOTAL_MS ? 'BUILDING' : outcome;

    return rawDeployment(project, {
      uid,
      created,
      buildingAt: state === 'QUEUED' ? null : created + queueMs,
      ready: state === 'QUEUED' || state === 'BUILDING' ? null : created + SIM_TOTAL_MS,
      state,
      target,
      branch,
      message,
      sha: commitSha,
      author: DEMO_AUTHOR,
      login: DEMO_OWNER,
      urlSlug,
      demo: {
        durationMs: buildMs,
        outcome,
        failure,
        elapsedMs: state === 'QUEUED' ? null : Math.min(elapsed - queueMs, buildMs),
      },
    });
  }

  /** Every deployment of one project at `now`, newest first. */
  function deploymentsFor(project, now) {
    const simulated = store
      .all()
      .filter((write) => write.projectName === project.name && write.deployment)
      .map((write) => simulatedDeployment(project, write, now));

    return [...simulated, ...cycleDeployments(project, now), ...historyFor(project, anchorFor(now))].sort(
      (a, b) => b.created - a.created,
    );
  }

  function rawProject(project, deployments) {
    const production = deployments.find((deployment) => deployment.target === 'production') || null;
    return {
      id: projectIdFor(project),
      name: project.name,
      framework: project.framework,
      nodeVersion: '22.x',
      updatedAt: deployments[0]?.created ?? null,
      link: {
        type: 'github',
        org: DEMO_OWNER,
        repo: project.name,
        repoId: repoIdFor(project),
        productionBranch: 'main',
      },
      targets: production ? { production: { ...production, id: production.uid } } : {},
      latestDeployments: deployments.slice(0, 3),
    };
  }

  function findDeployment(deploymentId, now) {
    for (const project of DEMO_PROJECTS) {
      const match = deploymentsFor(project, now).find((deployment) => deployment.uid === deploymentId);
      if (match) return { project, deployment: match };

      // A slow poller may ask about a cycle build that has already scrolled
      // out of the list; look back an hour of cycles before giving up.
      if (project.scenario === 'building') {
        const k = Math.floor(now / CYCLE_MS);
        for (let back = 2; back <= 30; back += 1) {
          const old = cycleDeployment(project, k - back, now);
          if (old.uid === deploymentId) return { project, deployment: old };
        }
      }
    }
    return null;
  }

  function recordDeployment(project, { kind, now, queueMs, target, branch, message, commitSha }) {
    const rng = createRng(`sim:${project.name}:${now}:${store.size}:${commitSha}`);
    const failure = target === 'production' ? scriptedFailure(project, filesFor(project)) : null;
    return store.record({
      kind,
      at: now,
      projectName: project.name,
      deployment: {
        uid: `dpl_${rng.base62(28)}`,
        urlSlug: rng.slug(9),
        queueMs,
        target,
        branch,
        message,
        commitSha,
        outcome: failure ? 'ERROR' : 'READY',
        failure,
      },
    });
  }

  return {
    mode: 'demo',

    async listProjects() {
      const now = clock();
      const projects = DEMO_PROJECTS.map((project) => normalizeProject(rawProject(project, deploymentsFor(project, now))));
      return { projects: sortProjects(projects), teamScoped: false };
    },

    async getProject(id) {
      const project = findProject(id);
      if (!project) throw vercelNotFound();
      return normalizeProject(rawProject(project, deploymentsFor(project, clock())));
    },

    async listDeployments(projectId, { limit = 20 } = {}) {
      const project = findProject(projectId);
      if (!project) throw vercelNotFound();
      return deploymentsFor(project, clock()).slice(0, limit).map(normalizeDeployment);
    },

    async getLogs(deploymentId) {
      const now = clock();
      const found = findDeployment(deploymentId, now);
      if (!found) throw vercelNotFound();

      const { project, deployment } = found;
      const { durationMs, outcome, failure, elapsedMs } = deployment.demo;
      if (deployment.state === 'QUEUED') return { lines: [], truncated: false };

      const events = buildLogEvents({
        project,
        deployment,
        outcome,
        failure,
        durationMs,
        elapsedMs: elapsedMs ?? Infinity,
      });
      // Through the real parser, so demo lines are shaped exactly like live ones.
      const lines = parseLogLines(JSON.stringify(events), MAX_LOG_LINES);
      return { lines, truncated: lines.length >= MAX_LOG_LINES };
    },

    async redeploy(projectId) {
      const project = findProject(projectId);
      if (!project) throw vercelNotFound();

      const now = clock();
      const latest = deploymentsFor(project, now).find((deployment) => deployment.target === 'production');
      const write = recordDeployment(project, {
        kind: 'redeploy',
        now,
        queueMs: SIM_QUEUE_AFTER_REDEPLOY_MS,
        target: 'production',
        branch: 'main',
        message: latest?.meta?.githubCommitMessage || 'Redeploy',
        commitSha: latest?.meta?.githubCommitSha || sha1(`${project.name}:${now}`),
      });
      const deployment = simulatedDeployment(project, write, now);

      return {
        id: deployment.uid,
        state: 'QUEUED',
        url: `https://${deployment.url}`,
        inspectorUrl: deployment.inspectorUrl,
        branch: 'main',
      };
    },

    async listActivity({ limit = ACTIVITY_LIMIT } = {}) {
      const now = clock();
      return DEMO_PROJECTS.flatMap((project) =>
        deploymentsFor(project, now).map((deployment) => ({ deployment, project })),
      )
        .sort((a, b) => b.deployment.created - a.deployment.created)
        .slice(0, limit)
        .map(({ deployment, project }) => ({
          ...normalizeDeployment(deployment),
          projectId: projectIdFor(project),
          projectName: project.name,
        }));
    },

    async getTree(owner, repo, ref) {
      const project = findRepo(owner, repo);
      if (!project || (ref && ref !== 'main')) throw githubNotFound();

      return {
        branch: 'main',
        defaultBranch: 'main',
        truncated: false,
        files: toTreeFiles([...filesFor(project).values()]),
        repo: {
          owner: DEMO_OWNER,
          name: project.name,
          url: `https://github.com/${DEMO_OWNER}/${project.name}`,
          private: false,
          description: project.tagline,
        },
      };
    },

    async getFile(owner, repo, path, ref) {
      const project = findRepo(owner, repo);
      if (!project || (ref && ref !== 'main')) throw githubNotFound();

      const files = filesFor(project);
      const clean = String(path).replace(/^\/+/, '');
      const file = files.get(clean);
      if (!file) {
        const prefix = `${clean.replace(/\/+$/, '')}/`;
        if ([...files.keys()].some((key) => key.startsWith(prefix))) throw directoryNotFile();
        throw githubNotFound('Not Found');
      }
      if (file.size > MAX_EDITABLE_BYTES) throw fileTooLarge();

      return {
        path: file.path,
        sha: file.sha,
        size: file.size,
        binary: file.binary,
        content: file.binary ? '' : file.content,
        url: `https://github.com/${DEMO_OWNER}/${project.name}/blob/main/${file.path}`,
      };
    },

    async putFile({ owner, repo, path, branch, message, content, sha }) {
      const project = findRepo(owner, repo);
      const target = branch || 'main';
      if (!project || target !== 'main') throw githubNotFound();

      const clean = String(path).replace(/^\/+/, '');
      const current = filesFor(project).get(clean);
      if (!current) throw githubNotFound('Not Found');
      // GitHub's own wording for a stale write, mapped through the same 409 path.
      if (current.sha !== sha) throw conflictError(`${clean} does not match ${sha}`);

      const size = Buffer.byteLength(content, 'utf8');
      if (size > MAX_EDITABLE_BYTES) throw fileTooLarge();

      const now = clock();
      const newSha = blobSha(content);
      const commitSha = sha1(`${project.name}:${clean}:${newSha}:${now}:${store.size}`);

      // The simulated build sees the repo *with* this change applied — that is
      // how fixing synapse-web's bug in the editor makes its next build pass.
      const after = filesFor(project);
      after.set(clean, { path: clean, binary: false, content, size, sha: newSha });
      const failure = scriptedFailure(project, after);
      const rng = createRng(`sim:${project.name}:${commitSha}`);

      store.record({
        kind: 'commit',
        at: now,
        projectName: project.name,
        path: clean,
        content,
        size,
        sha: newSha,
        commit: { sha: commitSha, message, author: DEMO_AUTHOR, login: DEMO_OWNER, date: new Date(now).toISOString() },
        deployment: {
          uid: `dpl_${rng.base62(28)}`,
          urlSlug: rng.slug(9),
          queueMs: SIM_QUEUE_AFTER_COMMIT_MS,
          target: 'production',
          branch: 'main',
          message,
          commitSha,
          outcome: failure ? 'ERROR' : 'READY',
          failure,
        },
      });

      return {
        commit: {
          sha: commitSha,
          url: `https://github.com/${DEMO_OWNER}/${project.name}/commit/${commitSha}`,
          message,
        },
        file: { path: clean, sha: newSha, size },
      };
    },

    async listCommits(owner, repo, { ref, perPage = 10 } = {}) {
      const project = findRepo(owner, repo);
      if (!project) throw githubNotFound();

      const branch = ref || 'main';
      const now = clock();
      const seen = new Set();
      const commits = [];

      for (const write of store.all()) {
        if (write.kind !== 'commit' || write.projectName !== project.name || branch !== 'main') continue;
        commits.push({ ...write.commit, at: write.at });
      }
      for (const deployment of deploymentsFor(project, now)) {
        if (deployment.meta.githubCommitRef !== branch) continue;
        commits.push({
          sha: deployment.meta.githubCommitSha,
          message: deployment.meta.githubCommitMessage,
          author: deployment.meta.githubCommitAuthorName,
          login: deployment.meta.githubCommitAuthorLogin,
          // The commit lands a few seconds before Vercel picks it up.
          at: deployment.created - 4000,
        });
      }

      return commits
        .sort((a, b) => b.at - a.at)
        .filter((commit) => (seen.has(commit.sha) ? false : seen.add(commit.sha)))
        .slice(0, perPage)
        .map((commit) =>
          normalizeCommit({
            sha: commit.sha,
            html_url: `https://github.com/${DEMO_OWNER}/${project.name}/commit/${commit.sha}`,
            commit: { message: commit.message, author: { name: commit.author, date: new Date(commit.at).toISOString() } },
            author: { login: commit.login, avatar_url: AVATARS[commit.login] || null },
          }),
        );
    },
  };
}
