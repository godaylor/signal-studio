import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { ExportError } from '@/server/exports/contracts';
import { boundedExportRequest } from '@/server/exports/http';
import { LifecycleError, lifecycleRequestSchema } from '@/server/lifecycle/contracts';
import { createLifecycle, listLifecycle } from '@/server/lifecycle/service';

async function handle(request: Request, params: Promise<{ projectId: string }>, write: boolean) {
  const requestId = randomUUID();
  const headers = { 'cache-control': 'private, no-store', 'x-request-id': requestId };
  try {
    const { auth, body, error } = write
      ? await parseRequest(await boundedExportRequest(request), lifecycleRequestSchema)
      : await parseRequest(request);
    if (error) return error();
    const projectId = z.uuid().parse((await params).projectId);
    return Response.json(
      {
        data: write
          ? await createLifecycle(auth, projectId, body)
          : await listLifecycle(auth, projectId),
      },
      { status: write ? 202 : 200, headers },
    );
  } catch (error) {
    const status =
      error instanceof LifecycleError || error instanceof ExportError ? error.status : error instanceof z.ZodError ? 400 : 500;
    const code =
      error instanceof LifecycleError || error instanceof ExportError
        ? error.code
        : status === 400
          ? 'lifecycle-invalid-request'
          : 'lifecycle-unavailable';
    return Response.json({ error: { code }, requestId }, { status, headers });
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(request, params, false);
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(request, params, true);
}
