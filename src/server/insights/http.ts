import { badRequest, forbidden, notFound } from '@/lib/response';
import { AnalysisValidationError } from '@/server/analytics/errors';
import {
  InsightForbiddenError,
  InsightNotFoundError,
  InvalidInsightCursorError,
} from './insight-service';

export function insightErrorResponse(error: unknown) {
  if (error instanceof AnalysisValidationError) {
    return badRequest({ code: error.code, message: error.message, details: error.details });
  }
  if (error instanceof InvalidInsightCursorError) {
    return badRequest({ code: 'invalid-insight-cursor', message: error.message });
  }
  if (error instanceof InsightForbiddenError) {
    return forbidden({ code: 'insight-write-access-denied', message: error.message });
  }
  if (error instanceof InsightNotFoundError) {
    return notFound({ code: 'insight-not-found', message: error.message });
  }
  throw error;
}
