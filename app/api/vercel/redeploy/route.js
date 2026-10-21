import { badRequest } from '@/lib/errors';
import { getSource } from '@/lib/source';
import { readJson, respond, respondError } from '@/lib/source/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/vercel/redeploy  { projectId }
 *
 * The provider looks the project's git link up server-side — the client never
 * supplies the repo id — and rebuilds the production branch.
 */
export async function POST(request) {
  const source = getSource(request);
  try {
    const body = await readJson(request, badRequest('Expected a JSON body of { projectId }.'));

    const projectId = body?.projectId;
    if (!projectId) throw badRequest('projectId is required.');

    return respond(source, { deployment: await source.redeploy(projectId) });
  } catch (error) {
    return respondError(source, error);
  }
}
