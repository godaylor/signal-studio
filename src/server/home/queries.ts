import type { AnalysisQueryV1 } from '@/server/analytics/contracts';

export function homeRanges(now: Date) {
  const weekEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  weekEnd.setUTCDate(weekEnd.getUTCDate() - ((weekEnd.getUTCDay() + 6) % 7));
  const range = (end: number) => ({
    startAt: new Date(end - 7 * 86_400_000).toISOString(),
    endAt: new Date(end).toISOString(),
  });
  return {
    activeRange: range(weekEnd.getTime()),
    cohortRange: range(weekEnd.getTime() - 21 * 86_400_000),
  };
}

export function homeQueries(projectId: string, now: Date, currencies: string[]) {
  const { activeRange, cohortRange } = homeRanges(now);
  const base = (measure: AnalysisQueryV1['measure'], cohort = false): AnalysisQueryV1 => ({
    version: 1,
    projectId,
    mode: 'trend',
    range: { ...(cohort ? cohortRange : activeRange), timezone: 'UTC', unit: 'week' },
    measure,
    filters: [],
    match: 'all',
    comparison: 'previousPeriod',
    visualization: 'table',
  });
  return [
    {
      id: 'activation',
      query: base({ source: 'lifecycle', key: 'activated', aggregation: 'count' }, true),
    },
    {
      id: 'retention',
      query: base({ source: 'lifecycle', key: 'retained', aggregation: 'count' }, true),
    },
    {
      id: 'signups',
      query: base({ source: 'lifecycle', key: 'signup', aggregation: 'count' }, true),
    },
    { id: 'users', query: base({ source: 'event', key: '*', aggregation: 'uniqueUsers' }) },
    { id: 'accounts', query: base({ source: 'event', key: '*', aggregation: 'uniqueAccounts' }) },
    {
      id: 'adoption',
      query: {
        ...base({ source: 'event', key: '*', aggregation: 'uniqueUsers' }),
        mode: 'breakdown' as const,
        breakdown: { field: 'eventName' as const, limit: 10 },
      },
    },
    ...currencies.map(currency => ({
      id: 'revenue:' + currency,
      query: base({ source: 'revenue', key: '*', aggregation: 'sum', property: currency }),
    })),
  ];
}
