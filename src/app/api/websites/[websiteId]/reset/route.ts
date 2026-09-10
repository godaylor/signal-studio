import { parseRequest } from '@/lib/request';
import { ok, unauthorized } from '@/lib/response';
import { canUpdateWebsite } from '@/permissions';
import { resetWebsite } from '@/queries/prisma';
import { LifecycleError } from '@/server/lifecycle/contracts';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { websiteId } = await params;

  if (!(await canUpdateWebsite(auth, websiteId))) {
    return unauthorized();
  }

  try { await resetWebsite(websiteId); }
  catch (error) {
    return Response.json({ error: { code: error instanceof LifecycleError ? error.code : 'reset-unavailable' } }, { status: error instanceof LifecycleError ? error.status : 500 });
  }

  return ok();
}
