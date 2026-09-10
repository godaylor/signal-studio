import { z } from 'zod';
import { analysisBehaviorSchema, analysisFilterSchema } from '@/server/analytics/contracts';

export const behavioralCohortDefinitionSchema = z.object({
  version: z.literal(1),
  entry: analysisBehaviorSchema,
  returning: analysisBehaviorSchema,
  granularity: z.enum(['day', 'week', 'month']),
  periods: z.number().int().min(1).max(12),
  filters: z.array(analysisFilterSchema).max(8).default([]),
  match: z.enum(['all', 'any']).default('all'),
});

export const createCohortSchema = z.object({
  name: z.string().trim().min(1).max(200),
  definition: behavioralCohortDefinitionSchema,
});

export type BehavioralCohortDefinition = z.infer<typeof behavioralCohortDefinitionSchema>;
