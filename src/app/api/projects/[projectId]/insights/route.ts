import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { insightCreateSchema, insightListSchema } from '@/server/insights/contracts';
import { insightErrorResponse } from '@/server/insights/http';
import { createInsight, listInsights } from '@/server/insights/insight-service';
import { getInsightAccess } from '@/server/permissions/insights';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, query, error } = await parseRequest(request, insightListSchema);
  if (error) return error();
  const { projectId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-insight-access-denied' });
  try {
    return json(
      await listInsights({
        access,
        search: query.search,
        ownerId: query.owner === 'mine' ? access.actorUserId : undefined,
        status: query.status,
        favorite: query.favorite === undefined ? undefined : query.favorite === 'true',
        cursor: query.cursor,
        limit: query.limit,
      }),
    );
  } catch (error) {
    return insightErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, insightCreateSchema);
  if (error) return error();
  const { projectId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-insight-access-denied' });
  try {
    const insight = await createInsight({ access, ...body });
    await recordSecurityAuditEvent({
      actorUserId: access.actorUserId,
      eventType: 'insight.created',
      outcome: 'success',
      metadata: { projectId, insightId: insight.id },
    });
    return json(insight);
  } catch (error) {
    return insightErrorResponse(error);
  }
}
