import { executeEventPostgresql } from './event-postgresql';
import type { AnalysisQueryV1, AnalysisRows, AnalysisTotal } from '../contracts';
import { throwIfAnalysisAborted } from '../errors';
import { executeAdvancedPostgresql } from './advanced-postgresql';
import { executeMetricPostgresql } from './metric-postgresql';

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
    } else {
      rows = await executeEventPostgresql(query);
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
