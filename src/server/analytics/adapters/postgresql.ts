import { EVENT_TYPE, OPERATORS } from '@/lib/constants';
import { filtersArrayToObject } from '@/lib/params';
import type { QueryFilters } from '@/lib/types';
import { getEventMetricsPostgresql } from '@/queries/sql/events/getEventMetrics';
import { getEventStatsPostgresql } from '@/queries/sql/events/getEventStats';
import type {
  AnalysisBreakdownRow,
  AnalysisFilter,
  AnalysisQueryV1,
  AnalysisRows,
  AnalysisTotal,
  AnalysisTrendRow,
} from '../contracts';
import { AnalysisValidationError, throwIfAnalysisAborted } from '../errors';
import { executeAdvancedPostgresql } from './advanced-postgresql';
import { executeMetricPostgresql } from './metric-postgresql';

const dimensionToLegacy = {
  eventName: 'event',
  urlPath: 'path',
  browser: 'browser',
  os: 'os',
  device: 'device',
  country: 'country',
} as const;

const operatorToLegacy = {
  equals: OPERATORS.equals,
  notEquals: OPERATORS.notEquals,
  contains: OPERATORS.contains,
  doesNotContain: OPERATORS.doesNotContain,
} as const;

type AdapterExecution = {
  rows: AnalysisRows;
  queryMs: number;
  rowsReturned: number;
  rowsScanned: number | null;
  freshnessAt: string;
  total?: AnalysisTotal;
};

export interface AnalysisAdapter {
  readonly name: 'postgresql';
  readonly exactness: 'exact';
  execute(query: AnalysisQueryV1, signal?: AbortSignal): Promise<AdapterExecution>;
}

function toLegacyFilters(query: AnalysisQueryV1, includeMeasure: boolean): QueryFilters {
  const endExclusive = new Date(query.range.endAt).getTime();
  const filters: AnalysisFilter[] = [
    ...query.filters,
    ...(includeMeasure && query.measure.key !== '*'
      ? [
          {
            field: 'eventName' as const,
            operator: 'equals' as const,
            value: query.measure.key,
          },
        ]
      : []),
  ];
  const legacy = filtersArrayToObject(
    filters.map(filter => ({
      name: dimensionToLegacy[filter.field],
      operator: operatorToLegacy[filter.operator],
      value: filter.value,
    })),
  );

  return {
    ...legacy,
    startDate: new Date(query.range.startAt),
    endDate: new Date(endExclusive),
    timezone: query.range.timezone,
    unit: query.range.unit,
    match: query.match,
    eventType: EVENT_TYPE.customEvent,
  };
}

function trendRows(
  rows: Array<{ x: string; t: string; y: number }>,
  eventKey: string,
): AnalysisTrendRow[] {
  const buckets = new Map<string, number>();

  for (const row of rows) {
    if (eventKey !== '*' && row.x !== eventKey) continue;
    buckets.set(String(row.t), (buckets.get(String(row.t)) ?? 0) + Number(row.y));
  }

  return [...buckets.entries()].map(([bucket, value]) => ({ bucket, value }));
}

function breakdownRows(rows: Array<{ x: string; y: number }>): AnalysisBreakdownRow[] {
  return rows.map(row => ({ key: String(row.x ?? '(not set)'), value: Number(row.y) }));
}

export const postgresqlAnalysisAdapter: AnalysisAdapter = {
  name: 'postgresql',
  exactness: 'exact',
  async execute(query, signal) {
    throwIfAnalysisAborted(signal);
    const startedAt = performance.now();
    let rows: AnalysisRows;
    let total: AnalysisTotal | undefined;

    if (query.mode === 'funnel' || query.mode === 'retention') {
      rows = await executeAdvancedPostgresql(query);
    } else if (query.measure.source !== 'event' || query.measure.aggregation !== 'count') {
      ({ rows, total } = await executeMetricPostgresql(query));
    } else if (query.mode === 'trend') {
      const legacyRows = await getEventStatsPostgresql(
        query.projectId,
        { eventName: query.measure.key === '*' ? undefined : query.measure.key },
        toLegacyFilters(query, false),
      );
      rows = trendRows(legacyRows, query.measure.key);
    } else {
      const field = query.breakdown?.field;
      if (!field) {
        throw new AnalysisValidationError(
          'analysis-breakdown-required',
          'Breakdown mode requires a breakdown field.',
          { path: ['breakdown'] },
        );
      }

      const legacyRows = await getEventMetricsPostgresql(
        query.projectId,
        {
          type: dimensionToLegacy[field],
          limit: String(query.breakdown.limit),
          offset: '0',
        },
        toLegacyFilters(query, true),
      );
      rows = breakdownRows(legacyRows);
    }

    throwIfAnalysisAborted(signal);
    return {
      rows,
      ...(total ? { total } : {}),
      queryMs: performance.now() - startedAt,
      rowsReturned: rows.length,
      rowsScanned: null,
      freshnessAt: new Date().toISOString(),
    };
  },
};
