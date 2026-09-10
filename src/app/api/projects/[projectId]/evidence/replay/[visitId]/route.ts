import { parseRequest } from '@/lib/request';
import { forbidden, json, notFound } from '@/lib/response';
import {
  getEvidenceReplay,
  ReplayEvidenceForbiddenError,
  SessionEvidenceNotFoundError,
} from '@/server/evidence/evidence-service';
import { resolveProjectAccess } from '@/server/permissions/capabilities';
import { projectDataScopeForCapabilities } from '@/server/permissions/project-data';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; visitId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId, visitId } = await params;
  const access = await resolveProjectAccess(auth, projectId);
  if (!access?.capabilities.viewIdentity)
    return forbidden({ code: 'project-evidence-access-denied' });
  const scope = projectDataScopeForCapabilities(access.capabilities);
  try {
    return json(await getEvidenceReplay(projectId, visitId, scope, access.capabilities.viewReplay));
  } catch (caught) {
    if (caught instanceof ReplayEvidenceForbiddenError)
      return forbidden({ code: 'project-replay-access-denied' });
    if (caught instanceof SessionEvidenceNotFoundError)
      return notFound({ code: 'replay-evidence-not-found' });
    throw caught;
  }
}
