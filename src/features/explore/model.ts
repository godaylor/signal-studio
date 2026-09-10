import type {
  AnalysisBreakdownRow,
  AnalysisFilter,
  AnalysisQueryV1,
  AnalysisTrendRow,
} from '@/server/analytics/contracts';

export type DisplayRow = {
  key: string;
  value: number;
  comparison?: number;
  change?: number | null;
};

export const analysisDimensions = [
  'eventName',
  'urlPath',
  'browser',
  'os',
  'device',
  'country',
] as const;

export const analysisOperators = ['equals', 'notEquals', 'contains', 'doesNotContain'] as const;

export const equalityOnlyDimensions = new Set<AnalysisFilter['field']>(['country']);

export function compatibleOperators(field: AnalysisFilter['field']) {
  return equalityOnlyDimensions.has(field) ? analysisOperators.slice(0, 2) : analysisOperators;
}

function utcDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function dateInputToUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function createDefaultAnalysisQuery(projectId: string, now = new Date()): AnalysisQueryV1 {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);

  return {
    version: 1,
    projectId,
    mode: 'trend',
    range: {
      startAt: dateInputToUtc(utcDay(start)),
      endAt: dateInputToUtc(utcDay(end)),
      timezone: 'UTC',
      unit: 'day',
    },
    measure: { source: 'event', key: '*', aggregation: 'count' },
    filters: [],
    match: 'all',
    comparison: 'none',
    visualization: 'line',
  };
}

function rowKey(row: AnalysisTrendRow | AnalysisBreakdownRow) {
  return 'bucket' in row ? row.bucket : row.key;
}

export function mergeAnalysisRows(
  rows: AnalysisTrendRow[] | AnalysisBreakdownRow[],
  comparison?: AnalysisTrendRow[] | AnalysisBreakdownRow[],
  alignComparisonByIndex = false,
): DisplayRow[] {
  const compared = new Map<string, number>(
    (comparison ?? []).map(row => [rowKey(row), Number(row.value)] as const),
  );

  return rows.map((row, index) => {
    const key = rowKey(row);
    const value = Number(row.value);
    const indexedValue = comparison?.[index]?.value;
    const comparisonValue = alignComparisonByIndex
      ? indexedValue === undefined
        ? undefined
        : Number(indexedValue)
      : compared.get(key);
    const change =
      comparisonValue === undefined
        ? undefined
        : comparisonValue === 0
          ? value === 0
            ? 0
            : null
          : ((value - comparisonValue) / comparisonValue) * 100;

    return {
      key,
      value,
      ...(comparisonValue !== undefined ? { comparison: comparisonValue, change } : {}),
    };
  });
}

export function comparisonLabel(query: AnalysisQueryV1) {
  if (query.comparison === 'previousPeriod') return 'Previous period';
  if (query.comparison === 'segment' && query.comparisonFilter) {
    const filter = query.comparisonFilter;
    return `${filter.field} ${filter.operator} ${filter.value}`;
  }
  return 'No comparison';
}

export function analysisSummary(query: AnalysisQueryV1, rows: DisplayRow[]) {
  if (query.measure.source !== 'event' || query.measure.aggregation !== 'count') {
    return `${query.measure.source} · ${query.measure.key} · ${query.measure.aggregation}: ${rows.length} exact metric buckets. See the separately computed range total; bucket values are not necessarily additive.`;
  }
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const noun =
    query.mode === 'trend' ? 'time buckets' : `${query.breakdown?.field ?? 'dimension'} values`;
  return `${query.measure.key} returned ${total} exact events across ${rows.length} ${noun}. ${comparisonLabel(query)}.`;
}

export function sessionFilterParams(query: AnalysisQueryV1, selected?: DisplayRow) {
  const params: Record<string, string | number> = {
    startAt: new Date(query.range.startAt).getTime(),
    endAt: new Date(query.range.endAt).getTime(),
    timezone: query.range.timezone,
    unit: query.range.unit,
    pageSize: 8,
    maxResults: 50,
  };
  const operatorCode = {
    equals: 'eq',
    notEquals: 'neq',
    contains: 'c',
    doesNotContain: 'dnc',
  } as const;
  const fieldKey = {
    eventName: 'event',
    urlPath: 'path',
    browser: 'browser',
    os: 'os',
    device: 'device',
    country: 'country',
  } as const;

  if (query.measure.key !== '*') params.event = `eq.${query.measure.key}`;
  for (const filter of query.filters) {
    params[fieldKey[filter.field]] = `${operatorCode[filter.operator]}.${filter.value}`;
  }

  if (selected && query.mode === 'breakdown' && query.breakdown) {
    params[fieldKey[query.breakdown.field]] = `eq.${selected.key}`;
  }

  return params;
}
