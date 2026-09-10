import { randomUUID } from 'node:crypto';
export const OPERATION_NAMES = ['ingestion.send', 'ingestion.record', 'ingestion.projection', 'analysis.query', 'server.error'] as const;
type OperationName = typeof OPERATION_NAMES[number];
type Outcome = 'success' | 'rejected' | 'failed' | 'hit' | 'miss' | 'bypass';
type Metric = { count: number; durationMs: number; maxDurationMs: number };
type OperationState = { startedAt: string; metrics: Record<string, Metric> };
const registry = globalThis as typeof globalThis & { __signalStudioOperations?: OperationState };
registry.__signalStudioOperations ??= { startedAt: new Date().toISOString(), metrics: {} };
const state = registry.__signalStudioOperations;
export function requestId(value?: string | null) {
  return value && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : randomUUID();
}
export function recordOperation(name: OperationName, outcome: Outcome, durationMs = 0) {
  const key = name + '.' + outcome;
  const item = state.metrics[key] ?? { count: 0, durationMs: 0, maxDurationMs: 0 };
  const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  state.metrics[key] = { count: Math.min(Number.MAX_SAFE_INTEGER, item.count + 1), durationMs: item.durationMs + duration, maxDurationMs: Math.max(item.maxDurationMs, duration) };
}
export function operationSnapshot() {
  return { startedAt: state.startedAt, scope: 'this-process-since-start', metrics: structuredClone(state.metrics),
    ingestionSemantics: 'HTTP outcomes, including intentional skips. Event delivery loss is unknown; not a zero-loss claim.' };
}
export function safeFailure(code: 'server-error' | 'identity-projection-failed' | 'heatmap-save-failed', id = requestId()) {
  recordOperation(code === 'server-error' ? 'server.error' : 'ingestion.projection', 'failed');
  console.error(JSON.stringify({ event: 'operation.failed', code, requestId: id }));
  return id;
}
export async function observeIngestion(channel: 'ingestion.send' | 'ingestion.record', request: Request, handler: (request: Request) => Promise<Response>) {
  const started = performance.now();
  const id = requestId(request.headers.get('x-request-id'));
  try {
    const response = await handler(request);
    const outcome = response.status >= 500 ? 'failed' : response.status >= 400 ? 'rejected' : 'success';
    recordOperation(channel, outcome, performance.now() - started);
    response.headers.set('x-request-id', id);
    console.info(JSON.stringify({ event: channel, requestId: id, status: response.status, durationMs: Math.round(performance.now() - started) }));
    return response;
  } catch {
    recordOperation(channel, 'failed', performance.now() - started);
    safeFailure('server-error', id);
    return Response.json({ error: { code: 'server-error', message: 'Server error', status: 500 } }, { status: 500, headers: { 'x-request-id': id } });
  }
}
