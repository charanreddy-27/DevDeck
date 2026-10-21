import { badRequest } from '@/lib/errors';
import { getSource } from '@/lib/source';
import { readJson, respond, respondError } from '@/lib/source/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/github/file?owner=&repo=&path=&ref= → decoded UTF-8 content + blob sha (binary content withheld). */
export async function GET(request) {
  const source = getSource(request);
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const path = searchParams.get('path');
  const ref = searchParams.get('ref');

  try {
    if (!owner || !repo || !path) throw badRequest('owner, repo and path are required.');

    return respond(source, await source.getFile(owner, repo, path, ref));
  } catch (error) {
    return respondError(source, error);
  }
}

/**
 * PUT /api/github/file
 * { owner, repo, path, branch, message, content, sha }
 *
 * `content` arrives as plain UTF-8 text; the provider handles encoding. The
 * sha is mandatory: a stale one is rejected with 409 `conflict`, never
 * force-overwritten.
 */
export async function PUT(request) {
  const source = getSource(request);
  try {
    const body = await readJson(request, badRequest('Expected a JSON body.'));

    const { owner, repo, path, branch, message, content, sha } = body || {};
    if (!owner || !repo || !path) throw badRequest('owner, repo and path are required.');
    if (!sha) throw badRequest('sha is required — reload the file and try again.');
    if (typeof content !== 'string') throw badRequest('content must be a string.');

    const commitMessage = (message || '').trim() || `Update ${path}`;
    const result = await source.putFile({ owner, repo, path, branch, message: commitMessage, content, sha });

    return respond(source, result);
  } catch (error) {
    return respondError(source, error);
  }
}
