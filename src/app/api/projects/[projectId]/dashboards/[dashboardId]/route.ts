import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { dashboardUpdateSchema } from '@/server/dashboards/contracts';
import { getDashboard, updateDashboard } from '@/server/dashboards/dashboard-service';
import { dashboardErrorResponse } from '@/server/dashboards/http';
import { getInsightAccess } from '@/server/permissions/insights';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; dashboardId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId, dashboardId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-dashboard-access-denied' });
  try {
    return json(await getDashboard(access, dashboardId));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; dashboardId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, dashboardUpdateSchema);
  if (error) return error();
  const { projectId, dashboardId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-dashboard-access-denied' });
  try {
    const dashboard = await updateDashboard({ access, dashboardId, ...body });
    await recordSecurityAuditEvent({
      actorUserId: access.actorUserId,
      eventType: 'dashboard.updated',
      outcome: 'success',
      metadata: { projectId, dashboardId },
    });
    return json(dashboard);
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
