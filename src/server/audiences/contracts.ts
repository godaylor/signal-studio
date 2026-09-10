import { z } from 'zod';
import { LIFECYCLE_STAGES } from '@/server/identities/definitions';
import { STANDARD_IDENTITY_TRAIT_KEYS } from '@/server/identities/traits';

export const identitySortFields = ['lastSeenAt', 'firstSeenAt', 'lifecycleStage'] as const;

export const identityListQuerySchema = z.object({
  cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(identitySortFields).default('lastSeenAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  lifecycle: z.enum(Object.values(LIFECYCLE_STAGES) as [string, ...string[]]).optional(),
});

const traitConditionSchema = z.object({
  kind: z.literal('trait'),
  field: z.enum(STANDARD_IDENTITY_TRAIT_KEYS as [string, ...string[]]),
  operator: z.enum(['equals', 'notEquals', 'contains', 'doesNotContain']),
  value: z.string().trim().min(1).max(200),
});

const lifecycleConditionSchema = z.object({
  kind: z.literal('lifecycle'),
  value: z.enum(Object.values(LIFECYCLE_STAGES) as [string, ...string[]]),
});

const behaviorConditionSchema = z.object({
  kind: z.literal('behavior'),
  eventName: z.string().trim().min(1).max(50),
  withinDays: z.number().int().min(1).max(90),
  minCount: z.number().int().min(1).max(100),
});

export const operationalSegmentDefinitionSchema = z.object({
  version: z.literal(1),
  entity: z.enum(['user', 'account']),
  match: z.enum(['all', 'any']),
  conditions: z
    .array(
      z.discriminatedUnion('kind', [
        traitConditionSchema,
        lifecycleConditionSchema,
        behaviorConditionSchema,
      ]),
    )
    .min(1)
    .max(8),
});

export const createOperationalSegmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  definition: operationalSegmentDefinitionSchema,
});

export const updateOperationalSegmentSchema = createOperationalSegmentSchema
  .partial()
  .refine(
    value => value.name !== undefined || value.definition !== undefined,
    'Provide one change.',
  );

export const previewOperationalSegmentSchema = z.object({
  definition: operationalSegmentDefinitionSchema,
});

export type IdentityListQuery = z.infer<typeof identityListQuerySchema>;
export type OperationalSegmentDefinition = z.infer<typeof operationalSegmentDefinitionSchema>;
export type OperationalSegmentCondition = OperationalSegmentDefinition['conditions'][number];
