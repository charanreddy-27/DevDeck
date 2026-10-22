/**
 * The live provider: real Vercel and GitHub accounts, via the server-side
 * tokens. This is the logic that used to sit inline in each route handler,
 * moved behind the provider interface unchanged — every error mapping, hint
 * and limit still comes from lib/vercel.js, lib/github.js and lib/errors.js.
 */
import { decodeBase64, encodeBase64, encodePath, githubFetch } from '../github.js';
import { parseLogLines } from '../logs.js';
import { normalizeCommit, normalizeDeployment, normalizeProject, normalizeState } from '../normalize.js';
import { vercelFetch, vercelTeamId } from '../vercel.js';
import {
  ACTIVITY_LIMIT,
  MAX_LOG_LINES,
  MAX_EDITABLE_BYTES,
  directoryNotFile,
  fileTooLarge,
  isBinaryText,
  noGithubRepo,
  sortProjects,
  toTreeFiles,
} from './shared.js';

function repoPath(owner, repo) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function contentsPath(owner, repo, path) {
  return `${repoPath(owner, repo)}/contents/${encodePath(path)}`;
}

export function createLiveSource() {
  return {
    mode: 'live',

    async listProjects() {
      const data = await vercelFetch('/v9/projects', { query: { limit: 100 } });
      return {
        projects: sortProjects((data?.projects || []).map(normalizeProject)),
        teamScoped: Boolean(vercelTeamId()),
      };
    },

    async getProject(id) {
      const project = await vercelFetch(`/v9/projects/${encodeURIComponent(id)}`);
      return normalizeProject(project);
    },

    async listDeployments(projectId, { limit = 20 } = {}) {
      const data = await vercelFetch('/v6/deployments', { query: { projectId, limit } });
      return (data?.deployments || []).map(normalizeDeployment);
    },

    async getLogs(deploymentId) {
      const text = await vercelFetch(`/v2/deployments/${encodeURIComponent(deploymentId)}/events`, {
        query: { builds: 1, limit: MAX_LOG_LINES },
        raw: true,
      });
      const lines = parseLogLines(text, MAX_LOG_LINES);
      return { lines, truncated: lines.length >= MAX_LOG_LINES };
    },

    /**
     * Looks the project's git link up server-side (the client never supplies
     * the repo id) and triggers a fresh production build from the production
     * branch.
     */
    async redeploy(projectId) {
      const project = await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}`);
      const link = project?.link;
      if (!link || link.type !== 'github' || !link.repoId) throw noGithubRepo();

      const branch = link.productionBranch || 'main';
      const deployment = await vercelFetch('/v13/deployments', {
        method: 'POST',
        body: {
          name: project.name,
          project: project.id,
          target: 'production',
          gitSource: { type: 'github', repoId: link.repoId, ref: branch },
        },
      });

      return {
        id: deployment?.id || deployment?.uid || null,
        state: normalizeState(deployment?.readyState ?? deployment?.status ?? 'QUEUED'),
        url: deployment?.url ? `https://${deployment.url}` : null,
        inspectorUrl: deployment?.inspectorUrl || null,
        branch,
      };
    },

    /**
     * Recent deployments across every project in one call — /v6/deployments
     * without a projectId. Each item already carries its project's id and
     * name, which is what makes per-project sparklines possible without N calls.
     */
    async listActivity({ limit = ACTIVITY_LIMIT } = {}) {
      const data = await vercelFetch('/v6/deployments', { query: { limit } });
      return (data?.deployments || []).map((deployment) => ({
        ...normalizeDeployment(deployment),
        projectId: deployment?.projectId || null,
        projectName: deployment?.name || null,
      }));
    },

    async getTree(owner, repo, ref) {
      const meta = await githubFetch(repoPath(owner, repo));
      const branch = ref || meta?.default_branch || 'main';

      const tree = await githubFetch(`${repoPath(owner, repo)}/git/trees/${encodeURIComponent(branch)}`, {
        query: { recursive: 1 },
      });

      return {
        branch,
        defaultBranch: meta?.default_branch || branch,
        truncated: Boolean(tree?.truncated),
        files: toTreeFiles((tree?.tree || []).filter((entry) => entry?.type === 'blob')),
        repo: {
          owner,
          name: repo,
          url: meta?.html_url || `https://github.com/${owner}/${repo}`,
          private: Boolean(meta?.private),
          description: meta?.description || null,
        },
      };
    },

    async getFile(owner, repo, path, ref) {
      const file = await githubFetch(contentsPath(owner, repo, path), { query: { ref } });

      if (Array.isArray(file)) throw directoryNotFile();
      if ((file?.size ?? 0) > MAX_EDITABLE_BYTES) throw fileTooLarge();

      const decoded = file?.content ? decodeBase64(file.content) : '';
      const binary = isBinaryText(decoded);

      return {
        path: file?.path || path,
        sha: file?.sha || null,
        size: file?.size ?? decoded.length,
        binary,
        content: binary ? '' : decoded,
        url: file?.html_url || null,
      };
    },

    /**
     * `content` arrives as plain UTF-8 text and is base64-encoded here — the
     * client never deals with encoding. The sha makes it safe: GitHub rejects
     * a stale one with 409, mapped to `conflict`. Never force-overwrites.
     */
    async putFile({ owner, repo, path, branch, message, content, sha }) {
      const result = await githubFetch(contentsPath(owner, repo, path), {
        method: 'PUT',
        body: { message, content: encodeBase64(content), sha, branch: branch || undefined },
      });

      return {
        commit: {
          sha: result?.commit?.sha || null,
          url: result?.commit?.html_url || null,
          message,
        },
        file: {
          path: result?.content?.path || path,
          sha: result?.content?.sha || null,
          size: result?.content?.size ?? null,
        },
      };
    },

    async listCommits(owner, repo, { ref, perPage = 10 } = {}) {
      const commits = await githubFetch(`${repoPath(owner, repo)}/commits`, {
        query: { per_page: perPage, sha: ref },
      });
      return (commits || []).map(normalizeCommit);
    },
  };
}
