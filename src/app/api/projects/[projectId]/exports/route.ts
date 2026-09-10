import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { createExportSchema } from '@/server/exports/contracts';
import { boundedExportRequest, exportErrorResponse, exportResponse } from '@/server/exports/http';
import { createExport, listExportJobs } from '@/server/exports/service';

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const requestId = randomUUID();
  try {
    const { auth, error } = await parseRequest(request);
    if (error) return error();
    const projectId = z.uuid().parse((await params).projectId);
    return Response.json({ data: await listExportJobs(auth, projectId) }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } });
  } catch (error) { return exportErrorResponse(error, requestId); }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const requestId = randomUUID();
  try {
    const { auth, body, error } = await parseRequest(await boundedExportRequest(request), createExportSchema);
    if (error) return error();
    const projectId = z.uuid().parse((await params).projectId);
    const result = await createExport(auth, projectId, body, requestId);
    if (result.kind === 'download') return exportResponse(result, requestId);
    return Response.json({ data: result.job }, { status: 202, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } });
  } catch (error) { return exportErrorResponse(error, requestId); }
}
