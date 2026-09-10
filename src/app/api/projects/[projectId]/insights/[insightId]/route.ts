import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { insightUpdateSchema } from '@/server/insights/contracts';
import { insightErrorResponse } from '@/server/insights/http';
import { getInsight, updateInsight } from '@/server/insights/insight-service';
import { getInsightAccess } from '@/server/permissions/insights';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; insightId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId, insightId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-insight-access-denied' });
  try {
    return json(await getInsight(access, insightId));
  } catch (error) {
    return insightErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; insightId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, insightUpdateSchema);
  if (error) return error();
  const { projectId, insightId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-insight-access-denied' });
  try {
    const insight = await updateInsight({ access, insightId, ...body });
    await recordSecurityAuditEvent({
      actorUserId: access.actorUserId,
      eventType: insight.status === 'archived' ? 'insight.archived' : 'insight.updated',
      outcome: 'success',
      metadata: { projectId, insightId },
    });
    return json(insight);
  } catch (error) {
    return insightErrorResponse(error);
  }
}
