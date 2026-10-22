import { badRequest } from '@/lib/errors';
import { getSource } from '@/lib/source';
import { respond, respondError } from '@/lib/source/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/vercel/logs?deploymentId= */
export async function GET(request) {
  const source = getSource(request);
  const { searchParams } = new URL(request.url);
  const deploymentId = searchParams.get('deploymentId');

  try {
    if (!deploymentId) throw badRequest('deploymentId is required.');

    const { lines, truncated } = await source.getLogs(deploymentId);
    return respond(source, { lines, truncated, fetchedAt: Date.now() });
  } catch (error) {
    return respondError(source, error);
  }
}
