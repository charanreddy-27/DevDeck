import { badRequest, errorResponse } from '@/lib/errors';
import { normalizeDeployment } from '@/lib/normalize';
import { vercelFetch } from '@/lib/vercel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/vercel/deployments?projectId=&limit=20 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);

  try {
    if (!projectId) throw badRequest('projectId is required.');

    const data = await vercelFetch('/v6/deployments', { query: { projectId, limit } });
    const deployments = (data?.deployments || []).map(normalizeDeployment);

    return Response.json({ deployments, fetchedAt: Date.now() });
  } catch (error) {
    return errorResponse(error);
  }
}
