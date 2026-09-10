import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json } from '@/lib/response';
import { previewOperationalSegmentSchema } from '@/server/audiences/contracts';
import {
  OperationalSegmentBudgetError,
  previewOperationalSegment,
} from '@/server/audiences/segment-service';
import { getInsightAccess } from '@/server/permissions/insights';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, previewOperationalSegmentSchema);
  if (error) return error();
  const { projectId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-segment-access-denied' });
  try {
    return json(await previewOperationalSegment(access, body.definition));
  } catch (caught) {
    if (caught instanceof OperationalSegmentBudgetError)
      return badRequest({ code: 'segment-preview-budget-exceeded', message: caught.message });
    throw caught;
  }
}
