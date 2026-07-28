import { errorResponse } from '@/lib/errors';
import { normalizeProject } from '@/lib/normalize';
import { vercelFetch, vercelTeamId } from '@/lib/vercel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/vercel/projects        → every project, newest deploy first
 * GET /api/vercel/projects?id=xyz → a single project
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      const project = await vercelFetch(`/v9/projects/${encodeURIComponent(id)}`);
      return Response.json({ project: normalizeProject(project) });
    }

    const data = await vercelFetch('/v9/projects', { query: { limit: 100 } });
    const projects = (data?.projects || [])
      .map(normalizeProject)
      .sort((a, b) => (b.lastDeployedAt || b.updatedAt || 0) - (a.lastDeployedAt || a.updatedAt || 0));

    return Response.json({
      projects,
      teamScoped: Boolean(vercelTeamId()),
      fetchedAt: Date.now(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
