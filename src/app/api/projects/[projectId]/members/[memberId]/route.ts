import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, notFound, ok } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { memberUpdateSchema } from '@/server/members/contracts';
import {
  deleteWorkspaceMember,
  MembershipConflictError,
  MembershipForbiddenError,
  MembershipNotFoundError,
  updateWorkspaceMember,
} from '@/server/members/membership-service';

function memberError(error: unknown) {
  if (error instanceof MembershipForbiddenError)
    return forbidden({ code: 'workspace-member-access-denied', message: error.message });
  if (error instanceof MembershipNotFoundError)
    return notFound({ code: 'workspace-member-not-found', message: error.message });
  if (error instanceof MembershipConflictError)
    return badRequest({ code: 'workspace-member-conflict', message: error.message });
  throw error;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; memberId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, memberUpdateSchema);
  if (error) return error();
  const { projectId, memberId } = await params;
  try {
    const member = await updateWorkspaceMember({ auth, projectId, memberId, ...body });
    await recordSecurityAuditEvent({
      actorUserId: auth.user.id,
      eventType: 'workspace.member-updated',
      outcome: 'success',
      metadata: { projectId, memberId, studioRole: member.studioRole },
    });
    return json({ data: member });
  } catch (caught) {
    return memberError(caught);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; memberId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId, memberId } = await params;
  try {
    await deleteWorkspaceMember(auth, projectId, memberId);
    await recordSecurityAuditEvent({
      actorUserId: auth.user.id,
      eventType: 'workspace.member-removed',
      outcome: 'success',
      metadata: { projectId, memberId },
    });
    return ok();
  } catch (caught) {
    return memberError(caught);
  }
}
