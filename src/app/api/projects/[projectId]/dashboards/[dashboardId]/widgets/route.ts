import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { widgetCreateSchema } from '@/server/dashboards/contracts';
import { addDashboardWidget } from '@/server/dashboards/dashboard-service';
import { dashboardErrorResponse } from '@/server/dashboards/http';
import { getInsightAccess } from '@/server/permissions/insights';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; dashboardId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, widgetCreateSchema);
  if (error) return error();
  const { projectId, dashboardId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-dashboard-access-denied' });
  try {
    const dashboard = await addDashboardWidget({ access, dashboardId, ...body });
    await recordSecurityAuditEvent({
      actorUserId: access.actorUserId,
      eventType: 'dashboard.widget-added',
      outcome: 'success',
      metadata: { projectId, dashboardId, kind: body.kind },
    });
    return json(dashboard);
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
