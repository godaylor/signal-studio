import type { AnalysisQueryV1, AnalysisResult } from '@/server/analytics/contracts';
export type HomeMetric = {
  id: string;
  query: AnalysisQueryV1;
  result: AnalysisResult | null;
  error: string | null;
};
export interface HomeSnapshot {
  generatedAt: string;
  activeRange: { startAt: string; endAt: string };
  cohortRange: { startAt: string; endAt: string };
  metrics: HomeMetric[];
  currenciesTruncated: boolean;
  health: {
    lastEventAt: string | null;
    observedEvents24h: number;
    state: 'observed' | 'stale' | 'empty';
    deliveryLoss: 'unknown';
  };
  atRisk: {
    permitted: boolean;
    accounts: Array<{ id: string; label: string; lastSeenAt: string }>;
  };
  recent: Array<{
    id: string;
    title: string;
    description: string;
    query: AnalysisQueryV1 | null;
    updatedAt: string;
  }>;
}
