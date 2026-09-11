import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { createAnalysisQueryService } from '@/server/analytics/query-service';
import { GOLDEN_RANGE, GOLDEN_TIMEZONE } from '@/test/analytics/golden';
import { seedGoldenPostgres } from './fixtures/golden-postgres';

describe('AnalysisQuery PostgreSQL golden reference', () => {
  let projectId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ websiteId: projectId, cleanup } = await seedGoldenPostgres());
  });

  afterAll(async () => {
    await cleanup?.();
    await prisma.client.$disconnect();
  });

  function query(mode: 'trend' | 'breakdown') {
    return {
      version: 1,
      projectId,
      mode,
      range: {
        startAt: GOLDEN_RANGE.startDate.toISOString(),
        endAt: GOLDEN_RANGE.endDate.toISOString(),
        timezone: GOLDEN_TIMEZONE,
        unit: 'day',
      },
      measure: { source: 'event', key: 'signup', aggregation: 'count' },
      ...(mode === 'breakdown' ? { breakdown: { field: 'urlPath', limit: 10 } } : {}),
      filters: [],
      match: 'all',
      comparison: 'none',
      visualization: mode === 'trend' ? 'line' : 'table',
    };
  }

  test('returns the exact DST-crossing signup trend and excludes endAt', async () => {
    const telemetry = vi.fn();
    const service = createAnalysisQueryService({ telemetry });
    const result = await service.execute({
      query: query('trend'),
      projectId,
      tenantId: projectId,
      permissionScope: 'identity-sensitive',
    });

    expect(result.data.rows).toEqual([
      { bucket: '2026-03-07 00:00:00', value: 2 },
      { bucket: '2026-03-08 00:00:00', value: 1 },
      { bucket: '2026-03-09 00:00:00', value: 1 },
    ]);
    expect(result).toMatchObject({ exactness: 'exact', cache: 'miss', queryVersion: 1 });
    expect(telemetry).toHaveBeenCalledWith(
      expect.objectContaining({ adapter: 'postgresql', rowsReturned: 3, rowsScanned: null }),
    );
  });

  test('returns the exact bounded breakdown through the independent event executor', async () => {
    const service = createAnalysisQueryService({ telemetry: vi.fn() });
    const result = await service.execute({
      query: query('breakdown'),
      projectId,
      tenantId: projectId,
      permissionScope: 'identity-sensitive',
    });

    expect(result.data.rows).toEqual([{ key: '/app/onboarding', value: 4 }]);
  });

  test('includes an event at the adjacent half-open start boundary exactly once', async () => {
    const service = createAnalysisQueryService({ telemetry: vi.fn() });
    const adjacent = {
      ...query('trend'),
      range: {
        startAt: GOLDEN_RANGE.endDate.toISOString(),
        endAt: new Date(GOLDEN_RANGE.endDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        timezone: 'UTC',
        unit: 'day',
      },
    };
    const result = await service.execute({
      query: adjacent,
      projectId,
      tenantId: projectId,
      permissionScope: 'identity-sensitive',
    });

    expect(result.data.rows).toEqual([{ bucket: '2026-03-11T00:00:00Z', value: 1 }]);
  });
});
