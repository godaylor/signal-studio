import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, notFound } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { memberCreateSchema, memberListQuerySchema } from '@/server/members/contracts';
import {
  createWorkspaceMember,
  listWorkspaceMembers,
  MembershipConflictError,
  MembershipForbiddenError,
  MembershipNotFoundError,
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, query, error } = await parseRequest(request, memberListQuerySchema);
  if (error) return error();
  const { projectId } = await params;
  try {
    return json(await listWorkspaceMembers(auth, projectId, query.limit));
  } catch (caught) {
    return memberError(caught);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, memberCreateSchema);
  if (error) return error();
  const { projectId } = await params;
  try {
    const member = await createWorkspaceMember({ auth, projectId, ...body });
    await recordSecurityAuditEvent({
      actorUserId: auth.user.id,
      eventType: 'workspace.member-added',
      outcome: 'success',
      metadata: { projectId, memberId: member.id, studioRole: member.studioRole },
    });
    return json({ data: member });
  } catch (caught) {
    return memberError(caught);
  }
}
