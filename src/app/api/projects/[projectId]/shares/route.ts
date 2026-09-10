import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, notFound } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { shareCreateSchema } from '@/server/shares/contracts';
import {
  createStudioShare,
  listStudioShares,
  StudioShareForbiddenError,
  StudioShareNotFoundError,
  StudioShareValidationError,
} from '@/server/shares/share-service';

function shareError(error: unknown) {
  if (error instanceof StudioShareForbiddenError)
    return forbidden({ code: 'studio-share-access-denied', message: error.message });
  if (error instanceof StudioShareNotFoundError)
    return notFound({ code: 'studio-share-not-found', message: error.message });
  if (error instanceof StudioShareValidationError)
    return badRequest({ code: 'studio-share-invalid', message: error.message });
  throw error;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId } = await params;
  try {
    return json(await listStudioShares(auth, projectId));
  } catch (caught) {
    return shareError(caught);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, shareCreateSchema);
  if (error) return error();
  const { projectId } = await params;
  try {
    const share = await createStudioShare({ auth, projectId, ...body });
    await recordSecurityAuditEvent({
      actorUserId: auth.user.id,
      eventType: 'studio-share.created',
      outcome: 'success',
      metadata: {
        projectId,
        shareId: share.id,
        resourceType: share.resourceType,
        visibility: share.visibility,
      },
    });
    return json({ data: share });
  } catch (caught) {
    return shareError(caught);
  }
}
