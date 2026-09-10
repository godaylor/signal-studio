import { z } from 'zod';

export const SAFE_SHARE_SCOPE = Object.freeze({
  version: 1,
  includeDefinitions: true,
  includeAggregateData: true,
  allowDrilldown: false,
  allowIdentity: false,
  allowSensitiveTraits: false,
  allowReplay: false,
});

export const shareResourceTypeSchema = z.enum(['insight', 'dashboard']);
export const shareVisibilitySchema = z.enum(['internal', 'public']);
export const safeShareScopeSchema = z
  .object({
    version: z.literal(1).default(1),
    includeDefinitions: z.boolean().default(true),
    includeAggregateData: z.boolean().default(true),
    allowDrilldown: z.literal(false).default(false),
    allowIdentity: z.literal(false).default(false),
    allowSensitiveTraits: z.literal(false).default(false),
    allowReplay: z.literal(false).default(false),
  })
  .strict();

export const shareCreateSchema = z.object({
  resourceType: shareResourceTypeSchema,
  resourceId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  visibility: shareVisibilitySchema,
  expiresAt: z.iso.datetime({ offset: true }),
  scope: safeShareScopeSchema.default(SAFE_SHARE_SCOPE),
});

export const shareUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
    scope: safeShareScopeSchema.optional(),
  })
  .refine(value => Object.keys(value).length > 0, { message: 'At least one share field is required.' });
