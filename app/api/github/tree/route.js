import { badRequest, errorResponse } from '@/lib/errors';
import { githubFetch } from '@/lib/github';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_EDITABLE_BYTES = 1024 * 1024; // 1 MB — anything larger is not offered for editing

/** GET /api/github/tree?owner=&repo=&ref= */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const ref = searchParams.get('ref');

  try {
    if (!owner || !repo) throw badRequest('owner and repo are required.');

    const meta = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const branch = ref || meta?.default_branch || 'main';

    const tree = await githubFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}`,
      { query: { recursive: 1 } },
    );

    const files = (tree?.tree || [])
      .filter((entry) => entry?.type === 'blob')
      .map((entry) => ({
        path: entry.path,
        sha: entry.sha,
        size: entry.size ?? 0,
        tooLarge: (entry.size ?? 0) > MAX_EDITABLE_BYTES,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    return Response.json({
      branch,
      defaultBranch: meta?.default_branch || branch,
      truncated: Boolean(tree?.truncated),
      files,
      repo: {
        owner,
        name: repo,
        url: meta?.html_url || `https://github.com/${owner}/${repo}`,
        private: Boolean(meta?.private),
        description: meta?.description || null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
