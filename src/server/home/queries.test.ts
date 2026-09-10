import { describe, expect, test } from 'vitest';
import { homeQueries, homeRanges } from './queries';
import { normalizeAnalysisQuery } from '@/server/analytics/normalize';
describe('Home query definitions', () => {
  test('uses the last completed UTC week and a fully mature cohort', () => {
    const now = new Date('2026-09-08T12:00:00Z');
    expect(homeRanges(now)).toEqual({
      activeRange: { startAt: '2026-08-31T00:00:00.000Z', endAt: '2026-09-07T00:00:00.000Z' },
      cohortRange: { startAt: '2026-08-10T00:00:00.000Z', endAt: '2026-08-17T00:00:00.000Z' },
    });
    const queries = homeQueries('11111111-1111-4111-8111-111111111111', now, ['USD', 'EUR']);
    expect(queries).toHaveLength(8);
    for (const item of queries) expect(normalizeAnalysisQuery(item.query)).toEqual(item.query);
    expect(queries.filter(item => item.id.startsWith('revenue:')).map(item => item.query.measure.property)).toEqual(['USD', 'EUR']);
  });
});
