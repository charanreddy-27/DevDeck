import { isGateEnabled } from '@/lib/auth/gate';
import { modeForRequest } from '@/lib/source';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/status → { mode, demo: { forced, available }, auth: { enabled } }
 *
 * Cheap and side-effect free: the app shell reads it to decide whether to show
 * the demo banner and the sign-out control. Booleans only — never a secret.
 */
export async function GET(request) {
  const { mode, forced, available } = modeForRequest(request);
  return Response.json(
    { mode, demo: { forced, available }, auth: { enabled: isGateEnabled() } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
