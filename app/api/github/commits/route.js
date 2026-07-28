import { badRequest, errorResponse } from '@/lib/errors';
import { githubFetch } from '@/lib/github';
import { normalizeCommit } from '@/lib/normalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/github/commits?owner=&repo=&ref=&per_page= */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const ref = searchParams.get('ref');
  const perPage = Math.min(Number(searchParams.get('per_page')) || 10, 50);

  try {
    if (!owner || !repo) throw badRequest('owner and repo are required.');

    const commits = await githubFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`,
      { query: { per_page: perPage, sha: ref } },
    );

    return Response.json({ commits: (commits || []).map(normalizeCommit) });
  } catch (error) {
    return errorResponse(error);
  }
}
