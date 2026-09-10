import { badRequest, forbidden, notFound } from '@/lib/response';
import {
  DashboardForbiddenError,
  DashboardInsightError,
  DashboardLimitError,
  DashboardNotFoundError,
} from './dashboard-service';

export function dashboardErrorResponse(error: unknown) {
  if (error instanceof DashboardForbiddenError) {
    return forbidden({ code: 'dashboard-write-access-denied', message: error.message });
  }
  if (error instanceof DashboardNotFoundError) {
    return notFound({ code: 'dashboard-not-found', message: error.message });
  }
  if (error instanceof DashboardLimitError) {
    return badRequest({ code: 'dashboard-widget-limit', message: error.message });
  }
  if (error instanceof DashboardInsightError) {
    return badRequest({ code: 'dashboard-insight-invalid', message: error.message });
  }
  throw error;
}
