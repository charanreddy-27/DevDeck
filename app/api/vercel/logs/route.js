import { badRequest, errorResponse } from '@/lib/errors.js';
import { parseLogLines } from '@/lib/logs.js';
import { vercelFetch } from '@/lib/vercel.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LINES = 3000;

/** GET /api/vercel/logs?deploymentId= */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const deploymentId = searchParams.get('deploymentId');

  try {
    if (!deploymentId) throw badRequest('deploymentId is required.');

    const text = await vercelFetch(`/v2/deployments/${encodeURIComponent(deploymentId)}/events`, {
      query: { builds: 1, limit: MAX_LINES },
      raw: true,
    });

    const lines = parseLogLines(text, MAX_LINES);

    return Response.json({ lines, truncated: lines.length >= MAX_LINES, fetchedAt: Date.now() });
  } catch (error) {
    return errorResponse(error);
  }
}
