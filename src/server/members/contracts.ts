import { z } from 'zod';
import { STUDIO_CAPABILITIES, STUDIO_ROLES } from '@/server/permissions/capabilities';

const capabilityOverrideShape = Object.fromEntries(
  STUDIO_CAPABILITIES.map(capability => [capability, z.boolean().optional()]),
) as Record<(typeof STUDIO_CAPABILITIES)[number], z.ZodOptional<z.ZodBoolean>>;

export const capabilityOverridesSchema = z.object(capabilityOverrideShape).strict();

export const memberListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const memberCreateSchema = z.object({
  username: z.string().trim().min(1).max(255),
  studioRole: z.enum(STUDIO_ROLES).exclude(['owner']),
  capabilityOverrides: capabilityOverridesSchema.default({}),
});

export const memberUpdateSchema = z
  .object({
    studioRole: z.enum(STUDIO_ROLES).exclude(['owner']).optional(),
    capabilityOverrides: capabilityOverridesSchema.optional(),
  })
  .refine(value => value.studioRole !== undefined || value.capabilityOverrides !== undefined, {
    message: 'At least one membership field is required.',
  });
