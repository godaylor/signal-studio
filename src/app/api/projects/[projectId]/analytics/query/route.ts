import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json } from '@/lib/response';
import { AnalysisValidationError } from '@/server/analytics/errors';
import { analysisQueryService } from '@/server/analytics/query-service';
import { getAnalysisAccess } from '@/server/permissions/analysis';

const requestSchema = z.record(z.string(), z.unknown());

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, requestSchema);

  if (error) return error();

  const { projectId } = await params;
  const access = await getAnalysisAccess(auth, projectId);

  if (!access) {
    return forbidden({ code: 'project-analysis-access-denied' });
  }

  try {
    return json(
      await analysisQueryService.execute({
        query: body,
        projectId,
        tenantId: access.tenantId,
        permissionScope: access.permissionScope,
        requestId: request.headers.get('x-request-id') ?? undefined,
        signal: request.signal,
      }),
    );
  } catch (error) {
    if (error instanceof AnalysisValidationError) {
      return badRequest({
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    throw error;
  }
}
