import { fromZonedTime } from 'date-fns-tz';
import type { AnalysisQueryV1, AnalysisRetentionRow } from '@/server/analytics/contracts';

/** Calendar-period maturity in query timezone, bounded by [start,end) and snapshot time. */
export function isRetentionObserved(
  row: AnalysisRetentionRow,
  query: AnalysisQueryV1,
  generatedAt: string,
) {
  if (row.period === 0) return true;
  const [year, month, day = 1] = row.cohortStart.split('-').map(Number);
  const unit = query.retention?.granularity ?? 'day';
  const end = new Date(Date.UTC(year, month - 1, day));
  if (unit === 'month') end.setUTCMonth(end.getUTCMonth() + row.period + 1);
  else end.setUTCDate(end.getUTCDate() + (row.period + 1) * (unit === 'week' ? 7 : 1));
  const periodEnd = fromZonedTime(end.toISOString().slice(0, 19), query.range.timezone).getTime();
  const observedUntil = Math.min(Date.parse(query.range.endAt), Date.parse(generatedAt));
  return Number.isFinite(periodEnd) && periodEnd <= observedUntil;
}
