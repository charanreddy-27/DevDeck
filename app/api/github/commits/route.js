import { badRequest } from '@/lib/errors';
import { getSource } from '@/lib/source';
import { respond, respondError } from '@/lib/source/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/github/commits?owner=&repo=&ref=&per_page= */
export async function GET(request) {
  const source = getSource(request);
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const ref = searchParams.get('ref');
  const perPage = Math.min(Number(searchParams.get('per_page')) || 10, 50);

  try {
    if (!owner || !repo) throw badRequest('owner and repo are required.');

    return respond(source, { commits: await source.listCommits(owner, repo, { ref, perPage }) });
  } catch (error) {
    return respondError(source, error);
  }
}
