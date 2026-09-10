import { parseRequest } from '@/lib/request';
import { forbidden, json, serviceUnavailable } from '@/lib/response';
import { liveSnapshotService } from '@/server/live/live-snapshot-service';
import { getAnalysisAccess } from '@/server/permissions/analysis';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { projectId } = await params;
  const access = await getAnalysisAccess(auth, projectId);
  if (!access) return forbidden({ code: 'project-live-access-denied' });

  try {
    return json(
      await liveSnapshotService.execute({
        projectId,
        tenantId: access.tenantId,
        permissionScope: access.permissionScope,
        requestId: request.headers.get('x-request-id') ?? undefined,
      }),
    );
  } catch {
    return serviceUnavailable({
      code: 'live-snapshot-unavailable',
      message: 'The live snapshot is temporarily unavailable. Retry without discarding prior data.',
    });
  }
}
