import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, notFound } from '@/lib/response';
import { sessionEvidenceQuerySchema } from '@/server/evidence/contracts';
import {
  getSessionEvidence,
  InvalidEvidenceCursorError,
  SessionEvidenceNotFoundError,
} from '@/server/evidence/evidence-service';
import { resolveProjectAccess } from '@/server/permissions/capabilities';
import { projectDataScopeForCapabilities } from '@/server/permissions/project-data';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, query, error } = await parseRequest(request, sessionEvidenceQuerySchema);
  if (error) return error();
  const { projectId } = await params;
  const access = await resolveProjectAccess(auth, projectId);
  if (!access?.capabilities.viewIdentity)
    return forbidden({ code: 'project-evidence-access-denied' });
  const scope = projectDataScopeForCapabilities(access.capabilities);
  try {
    return json(
      await getSessionEvidence({
        projectId,
        scope,
        capabilities: {
          viewSensitiveTraits: access.capabilities.viewSensitiveTraits,
          viewReplay: access.capabilities.viewReplay,
        },
        query,
      }),
    );
  } catch (caught) {
    if (caught instanceof SessionEvidenceNotFoundError)
      return notFound({ code: 'session-evidence-not-found' });
    if (caught instanceof InvalidEvidenceCursorError)
      return badRequest({ code: 'invalid-evidence-cursor', message: caught.message });
    throw caught;
  }
}
