import { ApiError, badRequest, errorResponse } from '@/lib/errors';
import { normalizeState } from '@/lib/normalize';
import { vercelFetch } from '@/lib/vercel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/vercel/redeploy  { projectId }
 *
 * Looks the project's git link up server-side (the client never supplies the
 * repo id) and triggers a fresh production build from the production branch.
 */
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      throw badRequest('Expected a JSON body of { projectId }.');
    }

    const projectId = body?.projectId;
    if (!projectId) throw badRequest('projectId is required.');

    const project = await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}`);
    const link = project?.link;

    if (!link || link.type !== 'github' || !link.repoId) {
      throw new ApiError('This project has no connected GitHub repository.', {
        status: 400,
        code: 'bad_request',
        service: 'vercel',
        hint: 'Connect a GitHub repo to the project in Vercel, then redeploy from here.',
      });
    }

    const deployment = await vercelFetch('/v13/deployments', {
      method: 'POST',
      body: {
        name: project.name,
        project: project.id,
        target: 'production',
        gitSource: {
          type: 'github',
          repoId: link.repoId,
          ref: link.productionBranch || 'main',
        },
      },
    });

    return Response.json({
      deployment: {
        id: deployment?.id || deployment?.uid || null,
        state: normalizeState(deployment?.readyState ?? deployment?.status ?? 'QUEUED'),
        url: deployment?.url ? `https://${deployment.url}` : null,
        inspectorUrl: deployment?.inspectorUrl || null,
        branch: link.productionBranch || 'main',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
