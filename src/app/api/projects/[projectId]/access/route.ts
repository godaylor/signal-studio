import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';
import { resolveProjectAccess } from '@/server/permissions/capabilities';
import { projectDataScopeForCapabilities } from '@/server/permissions/project-data';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId } = await params;
  const access = await resolveProjectAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-access-denied' });
  return json({
    data: {
      projectId,
      workspaceId: access.workspaceId,
      studioRole: access.studioRole,
      capabilities: access.capabilities,
      permissionScope: projectDataScopeForCapabilities(access.capabilities),
      isSystemAdmin: access.isSystemAdmin,
      isDirectOwner: access.isDirectOwner,
    },
  });
}
