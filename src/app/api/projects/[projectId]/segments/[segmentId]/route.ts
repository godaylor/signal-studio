import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, notFound, ok } from '@/lib/response';
import { updateOperationalSegmentSchema } from '@/server/audiences/contracts';
import {
  deleteOperationalSegment,
  getOperationalSegment,
  OperationalSegmentDependencyError,
  OperationalSegmentForbiddenError,
  OperationalSegmentNotFoundError,
  updateOperationalSegment,
} from '@/server/audiences/segment-service';
import { getInsightAccess } from '@/server/permissions/insights';

async function accessFor(request: Request, projectId: string) {
  const parsed = await parseRequest(request);
  if (parsed.error) return { error: parsed.error() } as const;
  const access = await getInsightAccess(parsed.auth, projectId);
  return access
    ? ({ access } as const)
    : ({ error: forbidden({ code: 'project-segment-access-denied' }) } as const);
}

function segmentError(caught: unknown) {
  if (caught instanceof OperationalSegmentNotFoundError)
    return notFound({ code: 'operational-segment-not-found' });
  if (caught instanceof OperationalSegmentForbiddenError)
    return forbidden({ code: 'project-segment-mutation-denied' });
  if (caught instanceof OperationalSegmentDependencyError)
    return Response.json(
      {
        error: {
          code: 'segment-has-dependencies',
          message: caught.message,
          status: 409,
          details: caught.dependencies,
        },
      },
      { status: 409 },
    );
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; segmentId: string }> },
) {
  const { projectId, segmentId } = await params;
  const context = await accessFor(request, projectId);
  if ('error' in context) return context.error;
  try {
    return json(await getOperationalSegment(context.access, segmentId));
  } catch (caught) {
    const response = segmentError(caught);
    if (response) return response;
    throw caught;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; segmentId: string }> },
) {
  const { projectId, segmentId } = await params;
  const { auth, body, error } = await parseRequest(request, updateOperationalSegmentSchema);
  if (error) return error();
  const access = await getInsightAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-segment-access-denied' });
  try {
    return json(await updateOperationalSegment({ access, segmentId, ...body }));
  } catch (caught) {
    if (caught instanceof Error && caught.name === 'ZodError')
      return badRequest({ code: 'segment-definition-invalid' });
    const response = segmentError(caught);
    if (response) return response;
    throw caught;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; segmentId: string }> },
) {
  const { projectId, segmentId } = await params;
  const context = await accessFor(request, projectId);
  if ('error' in context) return context.error;
  try {
    await deleteOperationalSegment(context.access, segmentId);
    return ok();
  } catch (caught) {
    const response = segmentError(caught);
    if (response) return response;
    throw caught;
  }
}
