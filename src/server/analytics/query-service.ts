import { randomUUID } from 'node:crypto';
import { type AnalysisAdapter, postgresqlAnalysisAdapter } from './adapters/postgresql';
import { getAnalysisCacheTtlSeconds, InMemoryAnalysisCache } from './cache';
import { buildAnalysisCacheKey } from './cache-key';
import type { AnalysisQueryV1, AnalysisResult } from './contracts';
import { getAnalysisDefinitions } from './definitions';
import { AnalysisValidationError } from './errors';
import { normalizeAnalysisQuery } from './normalize';
import { planAnalysisQuery } from './planner';
import {
  type AnalysisQueryTelemetry,
  type AnalysisTelemetrySink,
  emitAnalysisQueryTelemetry,
} from './telemetry';

export interface ExecuteAnalysisQueryInput {
  query: unknown;
  projectId: string;
  tenantId: string;
  permissionScope: string;
  requestId?: string;
  signal?: AbortSignal;
}

interface AnalysisQueryServiceDependencies {
  adapter?: AnalysisAdapter;
  cache?: InMemoryAnalysisCache;
  normalize?: (input: unknown) => AnalysisQueryV1;
  now?: () => number;
  telemetry?: AnalysisTelemetrySink;
}

function waitForWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(
      signal.reason instanceof Error
        ? signal.reason
        : new DOMException('The analysis query was cancelled.', 'AbortError'),
    );
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException('The analysis query was cancelled.', 'AbortError'),
      );
    };
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      value => {
        cleanup();
        resolve(value);
      },
      error => {
        cleanup();
        reject(error);
      },
    );
  });
}

export function createAnalysisQueryService({
  adapter = postgresqlAnalysisAdapter,
  cache = new InMemoryAnalysisCache(),
  normalize = normalizeAnalysisQuery,
  now = Date.now,
  telemetry = emitAnalysisQueryTelemetry,
}: AnalysisQueryServiceDependencies = {}) {
  const inFlight = new Map<string, Promise<AnalysisResult>>();

  return {
    async execute(input: ExecuteAnalysisQueryInput): Promise<AnalysisResult> {
      const requestId = input.requestId ?? randomUUID();
      const plannerStartedAt = performance.now();
      const query = normalize(input.query);

      if (query.projectId !== input.projectId) {
        throw new AnalysisValidationError(
          'analysis-project-mismatch',
          'AnalysisQuery projectId does not match the route project.',
          { path: ['projectId'], hint: 'Use the project ID from the analytical URL path.' },
        );
      }

      const plan = planAnalysisQuery(query);
      const plannerMs = performance.now() - plannerStartedAt;
      const cacheKey = buildAnalysisCacheKey({
        tenantId: input.tenantId,
        projectId: input.projectId,
        permissionScope: input.permissionScope,
        query,
        adapter: plan.adapter,
        exactness: plan.exactness,
      });
      const cached = cache.get(cacheKey, now());

      if (cached) {
        telemetry({
          requestId,
          cacheKey,
          adapter: plan.adapter,
          exactness: plan.exactness,
          cache: 'hit',
          outcome: 'success',
          plannerMs,
          sqlMs: 0,
          rowsReturned: cached.data.rows.length,
          rowsScanned: 0,
        });
        return { ...cached, cache: 'hit' };
      }

      const ttlSeconds = getAnalysisCacheTtlSeconds(query, now());
      const existing = inFlight.get(cacheKey);
      if (existing) {
        const result = await waitForWithAbort(existing, input.signal);
        telemetry({ requestId, cacheKey, adapter: plan.adapter, exactness: plan.exactness,
          cache: 'hit', outcome: 'success', plannerMs, sqlMs: 0, rowsReturned: result.data.rows.length, rowsScanned: 0 });
        return { ...result, cache: 'hit' };
      }

      const execution = (async () => {
        const [primary, comparison] = await Promise.all([
          adapter.execute(plan.query),
          plan.comparisonQuery ? adapter.execute(plan.comparisonQuery) : Promise.resolve(undefined),
        ]);
        const generatedAt = new Date(now()).toISOString();
        const result: AnalysisResult = {
          queryVersion: query.version,
          generatedAt,
          freshnessAt: primary.freshnessAt,
          exactness: plan.exactness,
          cache: ttlSeconds > 0 ? 'miss' : 'bypass',
          data: {
            mode: query.mode,
            rows: primary.rows,
            ...(comparison ? { comparison: comparison.rows } : {}),
            ...(primary.total ? { total: primary.total } : {}),
            ...(comparison?.total ? { comparisonTotal: comparison.total } : {}),
          },
          definitions: getAnalysisDefinitions(query),
          ...(query.measure.source === 'lifecycle' &&
          new Date(query.range.endAt).getTime() + 21 * 86_400_000 > now()
            ? {
                warnings: [
                  {
                    code: 'lifecycle-observation-incomplete',
                    message:
                      'The 21-day observation horizon is not complete. Rates may still change as cohort members return.',
                  },
                ],
              }
            : {}),
        };
        const event: AnalysisQueryTelemetry = {
          requestId,
          cacheKey,
          adapter: plan.adapter,
          exactness: plan.exactness,
          cache: result.cache,
          outcome: 'success',
          plannerMs,
          sqlMs: primary.queryMs + (comparison?.queryMs ?? 0),
          rowsReturned: primary.rowsReturned + (comparison?.rowsReturned ?? 0),
          rowsScanned:
            primary.rowsScanned === null || comparison?.rowsScanned === null
              ? null
              : primary.rowsScanned + (comparison?.rowsScanned ?? 0),
        };

        cache.set(cacheKey, result, ttlSeconds, now());
        telemetry(event);
        return result;
      })();

      inFlight.set(cacheKey, execution);
      execution.finally(() => inFlight.delete(cacheKey)).catch(() => undefined);

      try {
        return await waitForWithAbort(execution, input.signal);
      } catch (error) {
        telemetry({
          requestId,
          cacheKey,
          adapter: plan.adapter,
          exactness: plan.exactness,
          cache: ttlSeconds > 0 ? 'miss' : 'bypass',
          outcome:
            error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'error',
          plannerMs,
          sqlMs: 0,
          rowsReturned: 0,
          rowsScanned: null,
          errorCode:
            error instanceof AnalysisValidationError ? error.code : 'analysis-query-failed',
        });
        throw error;
      }
    },
  };
}

export const analysisQueryService = createAnalysisQueryService();
