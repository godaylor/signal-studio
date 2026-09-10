import { parseRequest } from '@/lib/request';
import { forbidden, json, notFound } from '@/lib/response';
import {
  getTrackedUserProfile,
  TrackedIdentityNotFoundError,
} from '@/server/identities/profile-service';
import { resolveProjectAccess } from '@/server/permissions/capabilities';
import { projectDataScopeForCapabilities } from '@/server/permissions/project-data';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; trackedUserId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId, trackedUserId } = await params;
  const access = await resolveProjectAccess(auth, projectId);
  if (!access?.capabilities.viewIdentity)
    return forbidden({ code: 'project-identity-access-denied' });
  const scope = projectDataScopeForCapabilities(access.capabilities);
  try {
    return json(await getTrackedUserProfile({ projectId, trackedUserId, scope }));
  } catch (caught) {
    if (caught instanceof TrackedIdentityNotFoundError)
      return notFound({ code: 'tracked-user-not-found' });
    throw caught;
  }
}
