import { z } from 'zod';
import {
  ANALYSIS_MAX_FILTERS,
  type AnalysisQueryV1,
  analysisFilterSchema,
} from '@/server/analytics/contracts';
import { normalizeAnalysisQuery } from '@/server/analytics/normalize';

export const dashboardGlobalContextSchema = z.object({
  range: z
    .object({
      startAt: z.iso.datetime({ offset: true }),
      endAt: z.iso.datetime({ offset: true }),
      timezone: z.string().trim().min(1).max(100).optional(),
    })
    .optional(),
  segment: analysisFilterSchema.optional(),
});
export type DashboardGlobalContext = z.infer<typeof dashboardGlobalContextSchema>;

export type DashboardContextResult =
  | { state: 'unchanged' | 'applied'; query: AnalysisQueryV1; reasons: string[] }
  | { state: 'incompatible'; query: AnalysisQueryV1; reasons: string[] };

export function applyDashboardContext(
  query: AnalysisQueryV1,
  context: DashboardGlobalContext,
): DashboardContextResult {
  if (!context.range && !context.segment) return { state: 'unchanged', query, reasons: [] };
  if (context.segment && query.match === 'any' && query.filters.length > 0) {
    return {
      state: 'incompatible',
      query,
      reasons: ['Segment override cannot preserve an existing match:any filter group.'],
    };
  }
  if (context.segment && query.filters.length >= ANALYSIS_MAX_FILTERS) {
    return {
      state: 'incompatible',
      query,
      reasons: [`Segment override would exceed the ${ANALYSIS_MAX_FILTERS}-filter query bound.`],
    };
  }

  try {
    const next = normalizeAnalysisQuery({
      ...query,
      ...(context.range
        ? {
            range: {
              ...query.range,
              startAt: context.range.startAt,
              endAt: context.range.endAt,
              timezone: context.range.timezone ?? query.range.timezone,
            },
          }
        : {}),
      ...(context.segment ? { filters: [...query.filters, context.segment], match: 'all' } : {}),
    });
    return {
      state: 'applied',
      query: next,
      reasons: [
        ...(context.range ? ['Global date range applied.'] : []),
        ...(context.segment ? ['Global segment applied.'] : []),
      ],
    };
  } catch (error) {
    return {
      state: 'incompatible',
      query,
      reasons: [error instanceof Error ? error.message : 'Global context is incompatible.'],
    };
  }
}
