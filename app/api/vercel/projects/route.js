import { getSource } from '@/lib/source';
import { respond, respondError } from '@/lib/source/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/vercel/projects        → every project, newest deploy first
 * GET /api/vercel/projects?id=xyz → a single project
 */
export async function GET(request) {
  const source = getSource(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      return respond(source, { project: await source.getProject(id) });
    }

    const { projects, teamScoped } = await source.listProjects();
    return respond(source, { projects, teamScoped, fetchedAt: Date.now() });
  } catch (error) {
    return respondError(source, error);
  }
}
