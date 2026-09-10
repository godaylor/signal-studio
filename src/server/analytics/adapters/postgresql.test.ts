import { beforeEach, describe, expect, test, vi } from 'vitest';
import { normalizeAnalysisQuery } from '../normalize';
import { validAnalysisQuery } from '../test-fixtures';
import { postgresqlAnalysisAdapter } from './postgresql';

const { eventStatsMock, eventMetricsMock } = vi.hoisted(() => ({
  eventStatsMock: vi.fn(),
  eventMetricsMock: vi.fn(),
}));

vi.mock('@/queries/sql/events/getEventStats', () => ({
  getEventStatsPostgresql: eventStatsMock,
}));
vi.mock('@/queries/sql/events/getEventMetrics', () => ({
  getEventMetricsPostgresql: eventMetricsMock,
}));

describe('PostgreSQL AnalysisQuery adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('wraps the legacy trend query and keeps the event measure separate from filters', async () => {
    eventStatsMock.mockResolvedValue([
      { x: 'signup', t: '2026-03-07 00:00:00', y: 2n },
      { x: 'purchase', t: '2026-03-07 00:00:00', y: 9n },
      { x: 'signup', t: '2026-03-08 00:00:00', y: 1n },
    ]);
    const query = normalizeAnalysisQuery(validAnalysisQuery());
    const result = await postgresqlAnalysisAdapter.execute(query);

    expect(result.rows).toEqual([
      { bucket: '2026-03-07 00:00:00', value: 2 },
      { bucket: '2026-03-08 00:00:00', value: 1 },
    ]);
    expect(eventStatsMock.mock.calls[0][1]).toEqual({ eventName: 'signup' });
    const filters = eventStatsMock.mock.calls[0][2];
    expect(filters.startDate.toISOString()).toBe(query.range.startAt);
    expect(filters.endDate.toISOString()).toBe(query.range.endAt);
    expect(filters.event).toBeUndefined();
  });

  test('uses whitelisted type and bounded limit for breakdown', async () => {
    eventMetricsMock.mockResolvedValue([{ x: '/app/onboarding', y: 4n }]);
    const query = normalizeAnalysisQuery(
      validAnalysisQuery({
        mode: 'breakdown',
        breakdown: { field: 'urlPath', limit: 20 },
        comparison: 'none',
        visualization: 'table',
      }),
    );
    const result = await postgresqlAnalysisAdapter.execute(query);

    expect(result.rows).toEqual([{ key: '/app/onboarding', value: 4 }]);
    expect(eventMetricsMock).toHaveBeenCalledWith(
      query.projectId,
      { type: 'path', limit: '20', offset: '0' },
      expect.objectContaining({ event: 'eq.signup' }),
    );
  });
});
