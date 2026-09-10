import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, notFound } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { shareUpdateSchema } from '@/server/shares/contracts';
import {
  revokeStudioShare,
  StudioShareForbiddenError,
  StudioShareNotFoundError,
  StudioShareValidationError,
  updateStudioShare,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; shareId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, shareUpdateSchema);
  if (error) return error();
  const { projectId, shareId } = await params;
  try {
    const share = await updateStudioShare({ auth, projectId, shareId, ...body });
    await recordSecurityAuditEvent({
      actorUserId: auth.user.id,
      eventType: 'studio-share.updated',
      outcome: 'success',
      metadata: { projectId, shareId, resourceType: share.resourceType },
    });
    return json({ data: share });
  } catch (caught) {
    return shareError(caught);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; shareId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId, shareId } = await params;
  try {
    const share = await revokeStudioShare(auth, projectId, shareId);
    await recordSecurityAuditEvent({
      actorUserId: auth.user.id,
      eventType: 'studio-share.revoked',
      outcome: 'success',
      metadata: { projectId, shareId, resourceType: share.resourceType },
    });
    return json({ data: share });
  } catch (caught) {
    return shareError(caught);
  }
}
