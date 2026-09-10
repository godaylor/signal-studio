import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json } from '@/lib/response';
import { createOperationalSegmentSchema } from '@/server/audiences/contracts';
import {
  createOperationalSegment,
  listOperationalSegments,
  OperationalSegmentForbiddenError,
} from '@/server/audiences/segment-service';
import { getInsightAccess } from '@/server/permissions/insights';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  const { projectId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-segment-access-denied' });
  return json(await listOperationalSegments(access));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, createOperationalSegmentSchema);
  if (error) return error();
  const { projectId } = await params;
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-segment-access-denied' });
  try {
    return json(await createOperationalSegment(access, body.name, body.definition));
  } catch (caught) {
    if (caught instanceof OperationalSegmentForbiddenError)
      return forbidden({ code: 'project-segment-mutation-denied' });
    if (caught instanceof Error && caught.name === 'ZodError')
      return badRequest({ code: 'segment-definition-invalid' });
    throw caught;
  }
}
