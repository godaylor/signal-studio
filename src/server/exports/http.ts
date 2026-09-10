import { z } from 'zod';
import { AnalysisValidationError } from '@/server/analytics/errors';
import { InvalidIdentityCursorError } from '@/server/identities/read-service';
import { ExportError } from './contracts';

export function exportErrorResponse(error: unknown, requestId: string) {
  const status =
    error instanceof ExportError
      ? error.status
      : error instanceof z.ZodError ||
          error instanceof AnalysisValidationError ||
          error instanceof InvalidIdentityCursorError
        ? 400
        : 500;
  const code =
    error instanceof ExportError || error instanceof AnalysisValidationError
      ? error.code
      : status === 400
        ? 'export-invalid-request'
        : 'export-unavailable';
  console.info(JSON.stringify({ event: 'export.request', requestId, outcome: 'failed', code }));
  return Response.json(
    { error: { code }, requestId },
    { status, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
  );
}

export function exportResponse(
  result: { data: Buffer | ReadableStream<Uint8Array>; filename: string; format: 'csv' | 'json' },
  requestId: string,
) {
  const data = Buffer.isBuffer(result.data) ? new Uint8Array(result.data) : result.data;
  return new Response(data, {
    headers: {
      'content-type':
        result.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${result.filename}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'x-request-id': requestId,
    },
  });
}

export async function boundedExportRequest(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ExportError('export-invalid-request');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 65_536) {
        await reader.cancel();
        throw new ExportError('export-request-too-large', 413);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: Buffer.concat(chunks),
    signal: request.signal,
  });
}
