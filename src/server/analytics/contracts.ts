import { z } from 'zod';

export const ANALYSIS_QUERY_VERSION = 1 as const;
export const ANALYSIS_MAX_FILTERS = 8;
export const ANALYSIS_MAX_BREAKDOWN_LIMIT = 50;
export const ANALYSIS_MAX_RANGE_DAYS = 366;
export const ANALYSIS_MAX_HOURLY_RANGE_DAYS = 31;
export const ANALYSIS_MAX_FUNNEL_STEPS = 8;
export const ANALYSIS_MAX_RETENTION_PERIODS = 12;

export const analysisDimensionSchema = z.enum([
  'eventName',
  'urlPath',
  'browser',
  'os',
  'device',
  'country',
]);

export const analysisOperatorSchema = z.enum(['equals', 'notEquals', 'contains', 'doesNotContain']);

export const analysisFilterSchema = z.object({
  field: analysisDimensionSchema,
  operator: analysisOperatorSchema,
  value: z.string().trim().min(1).max(200),
});

export const analysisBehaviorFilterSchema = z.object({
  property: z.string().trim().min(1).max(100),
  operator: analysisOperatorSchema,
  value: z.string().trim().min(1).max(200),
});

export const analysisBehaviorSchema = z.object({
  type: z.enum(['event', 'path']),
  value: z.string().trim().min(1).max(500),
  filters: z.array(analysisBehaviorFilterSchema).max(4).default([]),
});

export const analysisFunnelSchema = z.object({
  steps: z.array(analysisBehaviorSchema).min(2).max(ANALYSIS_MAX_FUNNEL_STEPS),
  conversionWindowMinutes: z.number().int().min(1).max(43_200),
});

export const analysisRetentionSchema = z.object({
  entry: analysisBehaviorSchema,
  returning: analysisBehaviorSchema,
  granularity: z.enum(['day', 'week', 'month']),
  periods: z.number().int().min(1).max(ANALYSIS_MAX_RETENTION_PERIODS),
  cohortId: z.uuid().optional(),
});

export const analysisQueryV1Schema = z
  .object({
    version: z.literal(ANALYSIS_QUERY_VERSION),
    projectId: z.uuid(),
    mode: z.enum(['trend', 'breakdown', 'funnel', 'retention']),
    range: z.object({
      startAt: z.iso.datetime({ offset: true }),
      endAt: z.iso.datetime({ offset: true }),
      timezone: z.string().trim().min(1).max(100),
      unit: z.enum(['hour', 'day', 'week', 'month']),
    }),
    measure: z.object({
      source: z.enum(['event', 'revenue', 'lifecycle']),
      key: z.string().trim().min(1).max(50),
      aggregation: z.enum(['count', 'uniqueUsers', 'uniqueAccounts', 'sessions', 'sum', 'average']),
      property: z.string().trim().min(1).max(50).optional(),
    }),
    breakdown: z
      .object({
        field: analysisDimensionSchema,
        limit: z.number().int().min(1).max(ANALYSIS_MAX_BREAKDOWN_LIMIT),
      })
      .optional(),
    filters: z.array(analysisFilterSchema).max(ANALYSIS_MAX_FILTERS).default([]),
    match: z.enum(['all', 'any']).default('all'),
    comparison: z.enum(['none', 'previousPeriod', 'segment']).default('none'),
    comparisonFilter: analysisFilterSchema.optional(),
    visualization: z.enum(['line', 'bar', 'table', 'matrix']).default('line'),
    funnel: analysisFunnelSchema.optional(),
    retention: analysisRetentionSchema.optional(),
  })
  .superRefine((query, context) => {
    if (query.mode === 'breakdown' && !query.breakdown) {
      context.addIssue({
        code: 'custom',
        message: 'Breakdown mode requires one bounded breakdown.',
        path: ['breakdown'],
      });
    }

    if (['trend', 'retention'].includes(query.mode) && query.breakdown) {
      context.addIssue({
        code: 'custom',
        message: 'Trend mode does not accept a breakdown.',
        path: ['breakdown'],
      });
    }

    if (query.mode === 'funnel' && !query.funnel) {
      context.addIssue({
        code: 'custom',
        message: 'Funnel mode requires between two and eight ordered steps.',
        path: ['funnel'],
      });
    }

    if (query.mode !== 'funnel' && query.funnel) {
      context.addIssue({
        code: 'custom',
        message: 'Funnel settings require funnel mode.',
        path: ['funnel'],
      });
    }

    if (query.mode === 'retention' && !query.retention) {
      context.addIssue({
        code: 'custom',
        message: 'Retention mode requires independent entry and return behaviors.',
        path: ['retention'],
      });
    }

    if (query.mode !== 'retention' && query.retention) {
      context.addIssue({
        code: 'custom',
        message: 'Retention settings require retention mode.',
        path: ['retention'],
      });
    }

    if (query.comparison === 'segment' && !query.comparisonFilter) {
      context.addIssue({
        code: 'custom',
        message: 'Segment comparison requires one typed comparison filter.',
        path: ['comparisonFilter'],
      });
    }

    if (query.comparison !== 'segment' && query.comparisonFilter) {
      context.addIssue({
        code: 'custom',
        message: 'A comparison filter is only valid for segment comparison.',
        path: ['comparisonFilter'],
      });
    }
  });

export type AnalysisDimension = z.infer<typeof analysisDimensionSchema>;
export type AnalysisOperator = z.infer<typeof analysisOperatorSchema>;
export type AnalysisFilter = z.infer<typeof analysisFilterSchema>;
export type AnalysisBehavior = z.infer<typeof analysisBehaviorSchema>;
export type AnalysisBehaviorFilter = z.infer<typeof analysisBehaviorFilterSchema>;
export type AnalysisQueryV1 = z.infer<typeof analysisQueryV1Schema>;

export type AnalysisTrendRow = { bucket: string; value: number };
export type AnalysisBreakdownRow = { key: string; value: number };
export type AnalysisFunnelStepRow = {
  kind: 'funnel-step';
  value: number;
  step: number;
  label: string;
  entrants: number;
  converted: number;
  dropped: number;
  stepConversionRate: number;
  overallConversionRate: number;
  segment?: string;
};
export type AnalysisFunnelTrendRow = {
  kind: 'funnel-trend';
  value: number;
  bucket: string;
  entrants: number;
  converted: number;
  conversionRate: number;
};
export type AnalysisFunnelDurationRow = {
  kind: 'funnel-duration';
  value: number;
  bucket: string;
  converted: number;
};
export type AnalysisRetentionRow = {
  kind: 'retention-cell';
  value: number;
  cohortStart: string;
  period: number;
  cohortSize: number;
  retained: number;
  retentionRate: number;
};
export type AnalysisRows =
  | AnalysisTrendRow[]
  | AnalysisBreakdownRow[]
  | Array<AnalysisFunnelStepRow | AnalysisFunnelTrendRow | AnalysisFunnelDurationRow>
  | AnalysisRetentionRow[];

export interface AnalysisResultData {
  mode: AnalysisQueryV1['mode'];
  rows: AnalysisRows;
  comparison?: AnalysisRows;
  total?: AnalysisTotal;
  comparisonTotal?: AnalysisTotal;
}

export interface AnalysisTotal {
  value: number;
  denominator?: number;
  rate?: number | null;
}

export interface AnalysisDefinition {
  key: string;
  label: string;
  description: string;
}

export interface AnalysisResult {
  queryVersion: typeof ANALYSIS_QUERY_VERSION;
  generatedAt: string;
  freshnessAt: string;
  exactness: 'exact' | 'approximate';
  cache: 'hit' | 'miss' | 'bypass';
  data: AnalysisResultData;
  definitions: AnalysisDefinition[];
  warnings?: Array<{ code: string; message: string }>;
}
