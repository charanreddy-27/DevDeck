/**
 * Vercel's payloads are large and inconsistent between endpoints (`state` vs
 * `readyState`, `created` vs `createdAt`). Everything is normalized here so the
 * UI only ever sees one shape.
 */

const BUILDING_STATES = new Set(['BUILDING', 'INITIALIZING', 'DEPLOYING', 'UPLOADING']);

export const STATUS = {
  READY: 'READY',
  BUILDING: 'BUILDING',
  QUEUED: 'QUEUED',
  ERROR: 'ERROR',
  CANCELED: 'CANCELED',
  NONE: 'NONE',
};

export function normalizeState(state) {
  if (!state) return STATUS.NONE;
  const value = String(state).toUpperCase();
  if (value === 'READY') return STATUS.READY;
  if (value === 'ERROR' || value === 'FAILED') return STATUS.ERROR;
  if (value === 'QUEUED') return STATUS.QUEUED;
  if (value === 'CANCELED' || value === 'CANCELLED') return STATUS.CANCELED;
  if (BUILDING_STATES.has(value)) return STATUS.BUILDING;
  return STATUS.NONE;
}

function toHttpsUrl(value) {
  if (!value) return null;
  const host = typeof value === 'string' ? value : value.domain || value.url || null;
  if (!host) return null;
  return /^https?:\/\//i.test(host) ? host : `https://${host}`;
}

function firstAlias(deployment) {
  const alias = deployment?.alias;
  if (Array.isArray(alias) && alias.length) {
    // Prefer the shortest alias — that's almost always the canonical domain.
    const hosts = alias.map((entry) => (typeof entry === 'string' ? entry : entry?.domain)).filter(Boolean);
    if (hosts.length) return hosts.slice().sort((a, b) => a.length - b.length)[0];
  }
  return null;
}

/** Picks the deployment that best represents "what is live in production". */
function productionDeployment(project) {
  const target = project?.targets?.production;
  if (target) return target;
  const list = Array.isArray(project?.latestDeployments) ? project.latestDeployments : [];
  return list.find((d) => d?.target === 'production') || list[0] || null;
}

function gitLink(project) {
  const link = project?.link;
  if (!link) return { repo: null, provider: null };

  const provider = link.type || null;
  if (provider !== 'github' || !link.org || !link.repo) {
    return { repo: null, provider };
  }

  return {
    provider,
    repo: {
      owner: link.org,
      name: link.repo,
      repoId: link.repoId ?? null,
      branch: link.productionBranch || 'main',
      url: `https://github.com/${link.org}/${link.repo}`,
    },
  };
}

export function normalizeProject(project) {
  const deployment = productionDeployment(project);
  const { repo, provider } = gitLink(project);
  const meta = deployment?.meta || {};

  const createdAt = deployment?.createdAt ?? deployment?.created ?? null;

  return {
    id: project?.id || null,
    name: project?.name || 'unnamed',
    framework: project?.framework || null,
    status: normalizeState(deployment?.readyState ?? deployment?.state),
    lastDeployedAt: typeof createdAt === 'number' ? createdAt : null,
    productionUrl: toHttpsUrl(firstAlias(deployment) || deployment?.url),
    deploymentId: deployment?.id || deployment?.uid || null,
    inspectorUrl: deployment?.inspectorUrl || null,
    commitMessage: firstLine(meta.githubCommitMessage),
    commitBranch: meta.githubCommitRef || repo?.branch || null,
    repo,
    gitProvider: provider,
    updatedAt: typeof project?.updatedAt === 'number' ? project.updatedAt : null,
    nodeVersion: project?.nodeVersion || null,
  };
}

export function normalizeDeployment(deployment) {
  const meta = deployment?.meta || {};
  const buildingAt = deployment?.buildingAt ?? null;
  const ready = deployment?.ready ?? null;

  return {
    id: deployment?.uid || deployment?.id || null,
    state: normalizeState(deployment?.state ?? deployment?.readyState),
    created: deployment?.created ?? deployment?.createdAt ?? null,
    ready,
    durationMs: buildingAt && ready && ready > buildingAt ? ready - buildingAt : null,
    url: toHttpsUrl(deployment?.url),
    inspectorUrl: deployment?.inspectorUrl || null,
    target: deployment?.target || 'preview',
    branch: meta.githubCommitRef || meta.gitlabCommitRef || meta.bitbucketCommitRef || null,
    commitMessage: firstLine(meta.githubCommitMessage || meta.gitlabCommitMessage || meta.bitbucketCommitMessage),
    commitSha: meta.githubCommitSha || meta.gitlabCommitSha || meta.bitbucketCommitSha || null,
    author:
      meta.githubCommitAuthorName ||
      meta.gitlabCommitAuthorName ||
      meta.bitbucketCommitAuthorName ||
      deployment?.creator?.username ||
      null,
    source: deployment?.source || null,
  };
}

export function normalizeCommit(commit) {
  return {
    sha: commit?.sha || null,
    message: firstLine(commit?.commit?.message),
    author: commit?.commit?.author?.name || commit?.author?.login || null,
    avatar: commit?.author?.avatar_url || null,
    date: commit?.commit?.author?.date || commit?.commit?.committer?.date || null,
    url: commit?.html_url || null,
  };
}

function firstLine(message) {
  if (!message) return null;
  const line = String(message).split('\n')[0].trim();
  return line || null;
}
