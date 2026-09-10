import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json } from '@/lib/response';
import { identityListQuerySchema } from '@/server/audiences/contracts';
import { InvalidIdentityCursorError, listTrackedUsers } from '@/server/identities/read-service';
import { resolveProjectAccess } from '@/server/permissions/capabilities';
import { projectDataScopeForCapabilities } from '@/server/permissions/project-data';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, query, error } = await parseRequest(request, identityListQuerySchema);

  if (error) {
    return error();
  }

  const { projectId } = await params;
  const access = await resolveProjectAccess(auth, projectId);

  if (!access?.capabilities.viewIdentity) {
    return forbidden({ code: 'project-identity-access-denied' });
  }
  const scope = projectDataScopeForCapabilities(access.capabilities);

  try {
    return json({
      ...(await listTrackedUsers({
        projectId,
        scope,
        cursor: query.cursor,
        limit: query.limit,
        search: query.search,
        sort: query.sort,
        direction: query.direction,
        lifecycle: query.lifecycle,
      })),
      permissionScope: scope,
    });
  } catch (error) {
    if (error instanceof InvalidIdentityCursorError) {
      return badRequest({ code: 'invalid-identity-cursor', message: error.message });
    }

    throw error;
  }
}
