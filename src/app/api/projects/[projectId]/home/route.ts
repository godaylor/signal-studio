import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, serverError } from '@/lib/response';
import { getHomeSnapshot } from '@/server/home/service';
import { resolveProjectAccess } from '@/server/permissions/capabilities';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId } = await params;
  if (!z.uuid().safeParse(projectId).success) return badRequest({ code: 'project-id-invalid' });
  const access = await resolveProjectAccess(auth, projectId);
  if (!access?.capabilities.viewAggregate) return forbidden({ code: 'project-home-access-denied' });
  try {
    const response = json(await getHomeSnapshot(access, request.signal));
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch {
    return serverError({ code: 'home-unavailable' });
  }
}
