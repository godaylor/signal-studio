import { recordOperation, requestId } from '@/server/operations/telemetry';

export interface AnalysisQueryTelemetry {
  requestId: string;
  cacheKey: string;
  adapter: string;
  exactness: string;
  cache: 'hit' | 'miss' | 'bypass';
  outcome: 'success' | 'cancelled' | 'error';
  plannerMs: number;
  sqlMs: number;
  rowsReturned: number;
  rowsScanned: number | null;
  errorCode?: string;
}

export type AnalysisTelemetrySink = (event: AnalysisQueryTelemetry) => void;

export const emitAnalysisQueryTelemetry: AnalysisTelemetrySink = event => {
  recordOperation('analysis.query', event.outcome === 'success' ? event.cache : 'failed', event.sqlMs);
  console.info(JSON.stringify({ event: 'analysis.query', ...event, requestId: requestId(event.requestId) }));
};
