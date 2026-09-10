import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { dashboardCreateSchema } from '@/server/dashboards/contracts';
import { createDashboard, listDashboards } from '@/server/dashboards/dashboard-service';
import { dashboardErrorResponse } from '@/server/dashboards/http';
import { getInsightAccess } from '@/server/permissions/insights';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-dashboard-access-denied' });
  return json({ data: await listDashboards(access) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, dashboardCreateSchema);
  if (error) return error();
  const { projectId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-dashboard-access-denied' });
  try {
    const dashboard = await createDashboard({ access, ...body });
    await recordSecurityAuditEvent({
      actorUserId: access.actorUserId,
      eventType: 'dashboard.created',
      outcome: 'success',
      metadata: { projectId, dashboardId: dashboard.id },
    });
    return json(dashboard);
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
