import { describe, expect, test } from 'vitest';
import type { AnalysisQueryV1 } from '@/server/analytics/contracts';
import { applyDashboardContext } from './context';

const query: AnalysisQueryV1 = {
  version: 1,
  projectId: 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003',
  mode: 'trend',
  range: {
    startAt: '2026-03-01T00:00:00.000Z',
    endAt: '2026-03-10T00:00:00.000Z',
    timezone: 'UTC',
    unit: 'day',
  },
  measure: { source: 'event', key: 'signup', aggregation: 'count' },
  filters: [],
  match: 'all',
  comparison: 'none',
  visualization: 'line',
};

describe('Dashboard global context', () => {
  test('applies date and segment overrides without mutating the saved Insight query', () => {
    const result = applyDashboardContext(query, {
      range: {
        startAt: '2026-03-02T00:00:00.000Z',
        endAt: '2026-03-05T00:00:00.000Z',
        timezone: 'UTC',
      },
      segment: { field: 'country', operator: 'equals', value: 'US' },
    });
    expect(result).toMatchObject({
      state: 'applied',
      query: { filters: [{ field: 'country', operator: 'equals', value: 'US' }] },
    });
    expect(query.filters).toEqual([]);
    expect(result.query.range.startAt).toBe('2026-03-02T00:00:00.000Z');
  });

  test('visibly rejects a segment override that would change match:any grouping', () => {
    const result = applyDashboardContext(
      {
        ...query,
        match: 'any',
        filters: [{ field: 'browser', operator: 'equals', value: 'Chrome' }],
      },
      {
        segment: { field: 'country', operator: 'equals', value: 'US' },
      },
    );
    expect(result).toMatchObject({ state: 'incompatible' });
    expect(result.reasons[0]).toMatch(/match:any/);
  });

  test('leaves a widget unchanged when no global override exists', () => {
    expect(applyDashboardContext(query, {})).toEqual({ state: 'unchanged', query, reasons: [] });
  });
});
