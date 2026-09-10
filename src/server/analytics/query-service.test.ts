import { describe, expect, test, vi } from 'vitest';
import type { AnalysisAdapter } from './adapters/postgresql';
import { InMemoryAnalysisCache } from './cache';
import type { AnalysisQueryV1 } from './contracts';
import { normalizeAnalysisQuery } from './normalize';
import { createAnalysisQueryService } from './query-service';
import { validAnalysisQuery } from './test-fixtures';

const projectId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-03-12T00:00:00.000Z').getTime();

function adapterResult(value = 4) {
  return {
    rows: [{ bucket: '2026-03-07 00:00:00', value }],
    queryMs: 12,
    rowsReturned: 1,
    rowsScanned: null,
    freshnessAt: '2026-03-11T04:00:01.000Z',
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    query: validAnalysisQuery({ comparison: 'none' }),
    projectId,
    tenantId: 'workspace-a',
    permissionScope: 'identity-standard',
    requestId: 'request-1',
    ...overrides,
  };
}

describe('AnalysisQuery service', () => {
  test('normalizes once, returns metadata and serves a bounded cache hit', async () => {
    const normalize = vi.fn((value: unknown) => normalizeAnalysisQuery(value));
    const adapter: AnalysisAdapter = {
      name: 'postgresql',
      exactness: 'exact',
      execute: vi.fn().mockResolvedValue(adapterResult()),
    };
    const telemetry = vi.fn();
    const service = createAnalysisQueryService({
      adapter,
      cache: new InMemoryAnalysisCache(),
      normalize,
      now: () => now,
      telemetry,
    });

    const first = await service.execute(input());
    const second = await service.execute(input({ requestId: 'request-2' }));

    expect(normalize).toHaveBeenCalledTimes(2);
    expect(adapter.execute).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({
      queryVersion: 1,
      generatedAt: '2026-03-12T00:00:00.000Z',
      freshnessAt: '2026-03-11T04:00:01.000Z',
      exactness: 'exact',
      cache: 'miss',
    });
    expect(second.cache).toBe('hit');
    expect(telemetry).toHaveBeenLastCalledWith(expect.objectContaining({ cache: 'hit', sqlMs: 0 }));
  });

  test('single-flights identical concurrent misses', async () => {
    let resolveAdapter: ((value: ReturnType<typeof adapterResult>) => void) | undefined;
    const pending = new Promise<ReturnType<typeof adapterResult>>(resolve => {
      resolveAdapter = resolve;
    });
    const adapter: AnalysisAdapter = {
      name: 'postgresql',
      exactness: 'exact',
      execute: vi.fn().mockReturnValue(pending),
    };
    const service = createAnalysisQueryService({
      adapter,
      now: () => now,
      telemetry: vi.fn(),
    });

    const first = service.execute(input());
    const second = service.execute(input({ requestId: 'request-2' }));
    expect(adapter.execute).toHaveBeenCalledTimes(1);
    resolveAdapter?.(adapterResult());

    await expect(first).resolves.toMatchObject({ cache: 'miss' });
    await expect(second).resolves.toMatchObject({ cache: 'hit' });
  });

  test('isolates cached results by tenant and permission scope', async () => {
    const adapter: AnalysisAdapter = {
      name: 'postgresql',
      exactness: 'exact',
      execute: vi.fn().mockResolvedValue(adapterResult()),
    };
    const service = createAnalysisQueryService({ adapter, now: () => now, telemetry: vi.fn() });

    await service.execute(input());
    await service.execute(input({ tenantId: 'workspace-b' }));
    await service.execute(input({ permissionScope: 'identity-sensitive' }));

    expect(adapter.execute).toHaveBeenCalledTimes(3);
  });

  test('cancels a superseded caller without multiplying the shared query', async () => {
    let resolveAdapter: ((value: ReturnType<typeof adapterResult>) => void) | undefined;
    const adapter: AnalysisAdapter = {
      name: 'postgresql',
      exactness: 'exact',
      execute: vi.fn().mockReturnValue(
        new Promise(resolve => {
          resolveAdapter = resolve;
        }),
      ),
    };
    const telemetry = vi.fn();
    const service = createAnalysisQueryService({ adapter, now: () => now, telemetry });
    const controller = new AbortController();
    const request = service.execute(input({ signal: controller.signal }));

    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(adapter.execute).toHaveBeenCalledTimes(1);
    resolveAdapter?.(adapterResult());
    await vi.waitFor(() =>
      expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'success' })),
    );
  });

  test('rejects route/query project mismatches before adapter execution', async () => {
    const adapter: AnalysisAdapter = {
      name: 'postgresql',
      exactness: 'exact',
      execute: vi.fn(),
    };
    const service = createAnalysisQueryService({ adapter, telemetry: vi.fn() });
    const mismatched = normalizeAnalysisQuery(validAnalysisQuery()) as AnalysisQueryV1;

    await expect(
      service.execute(input({
        projectId: '22222222-2222-4222-8222-222222222222',
        query: mismatched,
      })),
    ).rejects.toMatchObject({ code: 'analysis-project-mismatch' });
    expect(adapter.execute).not.toHaveBeenCalled();
  });
});
