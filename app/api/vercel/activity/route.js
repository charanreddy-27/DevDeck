import { summarizeActivity } from '@/lib/activity';
import { getSource } from '@/lib/source';
import { respond, respondError } from '@/lib/source/respond';
import { ACTIVITY_LIMIT } from '@/lib/source/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/vercel/activity?limit=100
 *
 * Recent deployments across every project, newest first, each tagged with
 * projectId/projectName, plus a summary (deploys per day, success rate,
 * median build time, recent outcomes per project) for the insights strip.
 */
export async function GET(request) {
  const source = getSource(request);
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit')) || ACTIVITY_LIMIT, 100);

  try {
    const deployments = await source.listActivity({ limit });
    const fetchedAt = Date.now();
    return respond(source, { deployments, summary: summarizeActivity(deployments, { now: fetchedAt }), fetchedAt });
  } catch (error) {
    return respondError(source, error);
  }
}
