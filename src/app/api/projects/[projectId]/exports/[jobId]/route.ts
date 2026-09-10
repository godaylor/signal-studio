import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { exportErrorResponse, exportResponse } from '@/server/exports/http';
import { cancelExport, downloadExport } from '@/server/exports/service';

const ids = z.object({ projectId: z.uuid(), jobId: z.uuid() });
type Context = { params: Promise<{ projectId: string; jobId: string }> };

export async function GET(request: Request, { params }: Context) {
  const requestId = randomUUID();
  try {
    const { auth, error } = await parseRequest(request);
    if (error) return error();
    const { projectId, jobId } = ids.parse(await params);
    return exportResponse(await downloadExport(auth, projectId, jobId), requestId);
  } catch (error) { return exportErrorResponse(error, requestId); }
}

export async function DELETE(request: Request, { params }: Context) {
  const requestId = randomUUID();
  try {
    const { auth, error } = await parseRequest(request);
    if (error) return error();
    const { projectId, jobId } = ids.parse(await params);
    await cancelExport(auth, projectId, jobId);
    return new Response(null, { status: 204 });
  } catch (error) { return exportErrorResponse(error, requestId); }
}
