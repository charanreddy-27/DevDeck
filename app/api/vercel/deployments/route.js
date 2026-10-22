import { badRequest } from '@/lib/errors';
import { getSource } from '@/lib/source';
import { respond, respondError } from '@/lib/source/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/vercel/deployments?projectId=&limit=20 */
export async function GET(request) {
  const source = getSource(request);
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);

  try {
    if (!projectId) throw badRequest('projectId is required.');

    const deployments = await source.listDeployments(projectId, { limit });
    return respond(source, { deployments, fetchedAt: Date.now() });
  } catch (error) {
    return respondError(source, error);
  }
}
