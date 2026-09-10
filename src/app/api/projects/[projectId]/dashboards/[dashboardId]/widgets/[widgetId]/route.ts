import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { widgetUpdateSchema } from '@/server/dashboards/contracts';
import {
  removeDashboardWidget,
  updateDashboardWidget,
} from '@/server/dashboards/dashboard-service';
import { dashboardErrorResponse } from '@/server/dashboards/http';
import { getInsightAccess } from '@/server/permissions/insights';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; dashboardId: string; widgetId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, widgetUpdateSchema);
  if (error) return error();
  const { projectId, dashboardId, widgetId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-dashboard-access-denied' });
  try {
    return json(await updateDashboardWidget({ access, dashboardId, widgetId, ...body }));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; dashboardId: string; widgetId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId, dashboardId, widgetId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-dashboard-access-denied' });
  try {
    const dashboard = await removeDashboardWidget(access, dashboardId, widgetId);
    await recordSecurityAuditEvent({
      actorUserId: access.actorUserId,
      eventType: 'dashboard.widget-removed',
      outcome: 'success',
      metadata: { projectId, dashboardId, widgetId },
    });
    return json(dashboard);
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
