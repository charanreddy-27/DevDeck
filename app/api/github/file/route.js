import { ApiError, badRequest, errorResponse } from '@/lib/errors';
import { decodeBase64, encodeBase64, encodePath, githubFetch } from '@/lib/github';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 1024 * 1024;
const NUL = String.fromCharCode(0);

function contentsPath(owner, repo, path) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`;
}

/** GET /api/github/file?owner=&repo=&path=&ref= */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const path = searchParams.get('path');
  const ref = searchParams.get('ref');

  try {
    if (!owner || !repo || !path) throw badRequest('owner, repo and path are required.');

    const file = await githubFetch(contentsPath(owner, repo, path), { query: { ref } });

    if (Array.isArray(file)) throw badRequest('That path is a directory, not a file.');
    if ((file?.size ?? 0) > MAX_BYTES) {
      throw new ApiError('File is larger than 1 MB and cannot be edited in DevDeck.', {
        status: 413,
        code: 'bad_request',
        service: 'github',
        hint: 'Edit large files locally and push with git.',
      });
    }

    const decoded = file?.content ? decodeBase64(file.content) : '';
    // A NUL byte anywhere is the cheap, reliable "this is not text" signal.
    const binary = decoded.includes(NUL);

    return Response.json({
      path: file?.path || path,
      sha: file?.sha || null,
      size: file?.size ?? decoded.length,
      binary,
      content: binary ? '' : decoded,
      url: file?.html_url || null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PUT /api/github/file
 * { owner, repo, path, branch, message, content, sha }
 *
 * `content` arrives as plain UTF-8 text and is base64-encoded here — the client
 * never has to deal with encoding.
 */
export async function PUT(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      throw badRequest('Expected a JSON body.');
    }

    const { owner, repo, path, branch, message, content, sha } = body || {};
    if (!owner || !repo || !path) throw badRequest('owner, repo and path are required.');
    if (!sha) throw badRequest('sha is required — reload the file and try again.');
    if (typeof content !== 'string') throw badRequest('content must be a string.');

    const commitMessage = (message || '').trim() || `Update ${path}`;

    const result = await githubFetch(contentsPath(owner, repo, path), {
      method: 'PUT',
      body: {
        message: commitMessage,
        content: encodeBase64(content),
        sha,
        branch: branch || undefined,
      },
    });

    return Response.json({
      commit: {
        sha: result?.commit?.sha || null,
        url: result?.commit?.html_url || null,
        message: commitMessage,
      },
      file: {
        path: result?.content?.path || path,
        sha: result?.content?.sha || null,
        size: result?.content?.size ?? null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
