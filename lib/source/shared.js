/**
 * Limits and errors both providers share. Living in one place is what keeps
 * the demo honest: a too-large file or a repo-less redeploy fails in demo mode
 * with exactly the error the live provider would return.
 */
import { ApiError, ERROR_CODES } from '../errors.js';

export const MAX_EDITABLE_BYTES = 1024 * 1024; // 1 MB — anything larger is listed but not editable
export const MAX_LOG_LINES = 3000;
export const ACTIVITY_LIMIT = 100;

// A NUL byte anywhere is the cheap, reliable "this is not text" signal.
const NUL = String.fromCharCode(0);

export function isBinaryText(decoded) {
  return String(decoded ?? '').includes(NUL);
}

export function fileTooLarge() {
  return new ApiError('File is larger than 1 MB and cannot be edited in DevDeck.', {
    status: 413,
    code: ERROR_CODES.BAD_REQUEST,
    service: 'github',
    hint: 'Edit large files locally and push with git.',
  });
}

export function noGithubRepo() {
  return new ApiError('This project has no connected GitHub repository.', {
    status: 400,
    code: ERROR_CODES.BAD_REQUEST,
    service: 'vercel',
    hint: 'Connect a GitHub repo to the project in Vercel, then redeploy from here.',
  });
}

export function directoryNotFile() {
  return new ApiError('That path is a directory, not a file.', { status: 400, code: ERROR_CODES.BAD_REQUEST });
}

/** Newest deploy first; projects that never deployed fall back to their update time. */
export function sortProjects(projects) {
  return projects
    .slice()
    .sort((a, b) => (b.lastDeployedAt || b.updatedAt || 0) - (a.lastDeployedAt || a.updatedAt || 0));
}

/** Tree entries in the shape the Code tab renders, sorted by path. */
export function toTreeFiles(entries) {
  return entries
    .map((entry) => ({
      path: entry.path,
      sha: entry.sha,
      size: entry.size ?? 0,
      tooLarge: (entry.size ?? 0) > MAX_EDITABLE_BYTES,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Every provider implements exactly these methods. Kept as data so a test can
 * assert both providers expose the full interface and nothing drifts.
 */
export const SOURCE_METHODS = [
  'listProjects',
  'getProject',
  'listDeployments',
  'getLogs',
  'redeploy',
  'listActivity',
  'getTree',
  'getFile',
  'putFile',
  'listCommits',
];
