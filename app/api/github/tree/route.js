import { badRequest } from '@/lib/errors';
import { getSource } from '@/lib/source';
import { respond, respondError } from '@/lib/source/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/github/tree?owner=&repo=&ref= → file tree + default branch. Files over 1 MB are flagged tooLarge. */
export async function GET(request) {
  const source = getSource(request);
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const ref = searchParams.get('ref');

  try {
    if (!owner || !repo) throw badRequest('owner and repo are required.');

    return respond(source, await source.getTree(owner, repo, ref));
  } catch (error) {
    return respondError(source, error);
  }
}
