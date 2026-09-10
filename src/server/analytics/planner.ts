import type { AnalysisQueryV1 } from './contracts';

export interface AnalysisPlan {
  query: AnalysisQueryV1;
  comparisonQuery?: AnalysisQueryV1;
  adapter: 'postgresql';
  exactness: 'exact';
}

function previousPeriod(query: AnalysisQueryV1): AnalysisQueryV1 {
  const start = new Date(query.range.startAt).getTime();
  const end = new Date(query.range.endAt).getTime();
  const duration = end - start;

  return {
    ...query,
    comparison: 'none',
    range: {
      ...query.range,
      startAt: new Date(start - duration).toISOString(),
      endAt: new Date(start).toISOString(),
    },
  };
}

function selectedSegment(query: AnalysisQueryV1): AnalysisQueryV1 {
  if (!query.comparisonFilter) return query;

  const { comparisonFilter, ...base } = query;

  return {
    ...base,
    comparison: 'none',
    match: 'all',
    filters: [...query.filters, comparisonFilter],
  };
}

export function planAnalysisQuery(query: AnalysisQueryV1): AnalysisPlan {
  return {
    query,
    ...(query.comparison === 'previousPeriod'
      ? { comparisonQuery: previousPeriod(query) }
      : query.comparison === 'segment'
        ? { comparisonQuery: selectedSegment(query) }
        : {}),
    adapter: 'postgresql',
    exactness: 'exact',
  };
}
