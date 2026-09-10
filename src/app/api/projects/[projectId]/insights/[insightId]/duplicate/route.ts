import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { insightErrorResponse } from '@/server/insights/http';
import { duplicateInsight } from '@/server/insights/insight-service';
import { getInsightAccess } from '@/server/permissions/insights';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; insightId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId, insightId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-insight-access-denied' });
  try {
    const insight = await duplicateInsight(access, insightId);
    await recordSecurityAuditEvent({
      actorUserId: access.actorUserId,
      eventType: 'insight.duplicated',
      outcome: 'success',
      metadata: { projectId, sourceInsightId: insightId, insightId: insight.id },
    });
    return json(insight);
  } catch (error) {
    return insightErrorResponse(error);
  }
}
