const projectId = '11111111-1111-4111-8111-111111111111';

export function validAnalysisQuery(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    projectId,
    mode: 'trend',
    range: {
      startAt: '2026-03-07T05:00:00.000Z',
      endAt: '2026-03-11T04:00:00.000Z',
      timezone: 'America/New_York',
      unit: 'day',
    },
    measure: { source: 'event', key: 'signup', aggregation: 'count' },
    filters: [],
    match: 'all',
    comparison: 'previousPeriod',
    visualization: 'line',
    ...overrides,
  };
}
