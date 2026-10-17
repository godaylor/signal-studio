import { describe, expect, test } from 'vitest';
import type { AnalysisQueryV1, AnalysisRetentionRow } from '@/server/analytics/contracts';
import { isRetentionObserved } from './retentionObservation';

const query = (timezone = 'UTC', granularity = 'day') =>
  ({
    range: { startAt: '2026-01-01T00:00:00Z', endAt: '2026-12-31T00:00:00Z', timezone },
    retention: { granularity },
  }) as AnalysisQueryV1;
const row = (cohortStart: string, period: number) =>
  ({ cohortStart, period }) as AnalysisRetentionRow;
describe('Retention observation calendar', () => {
  test('a future zero is not a completed observation; exact period end is complete', () => {
    expect(isRetentionObserved(row('2026-03-01', 1), query(), '2026-03-02T23:59:59Z')).toBe(false);
    expect(isRetentionObserved(row('2026-03-01', 1), query(), '2026-03-03T00:00:00Z')).toBe(true);
  });
  test('half-open query end bounds observation even for historical data', () => {
    const q = query();
    q.range.endAt = '2026-03-02T00:00:00Z';
    expect(isRetentionObserved(row('2026-03-01', 1), q, '2026-10-18T00:00:00Z')).toBe(false);
    expect(isRetentionObserved(row('2026-03-01', 0), q, '2026-10-18T00:00:00Z')).toBe(true);
  });
  test('uses local calendar boundaries across DST, not a fixed 24-hour duration', () => {
    expect(
      isRetentionObserved(row('2026-03-07', 1), query('America/New_York'), '2026-03-09T03:59:59Z'),
    ).toBe(false);
    expect(
      isRetentionObserved(row('2026-03-07', 1), query('America/New_York'), '2026-03-09T04:00:00Z'),
    ).toBe(true);
  });
  test('weeks and months have calendar horizons', () => {
    expect(
      isRetentionObserved(row('2026-03-02', 1), query('UTC', 'week'), '2026-03-16T00:00:00Z'),
    ).toBe(true);
    expect(
      isRetentionObserved(row('2026-01', 1), query('UTC', 'month'), '2026-02-28T23:59:59Z'),
    ).toBe(false);
    expect(
      isRetentionObserved(row('2026-01', 1), query('UTC', 'month'), '2026-03-01T00:00:00Z'),
    ).toBe(true);
  });
});
