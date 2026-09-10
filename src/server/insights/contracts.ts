import { z } from 'zod';
import { INSIGHT_STATUSES } from './insight-service';

export const insightCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).default(''),
  query: z.unknown().refine(value => value !== undefined, 'Query is required.'),
  visualization: z.record(z.string(), z.unknown()).default({}),
  favorite: z.boolean().default(false),
});

export const insightUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(500).optional(),
    query: z.unknown().optional(),
    visualization: z.record(z.string(), z.unknown()).optional(),
    favorite: z.boolean().optional(),
    status: z.enum(INSIGHT_STATUSES).optional(),
  })
  .refine(value => Object.values(value).some(item => item !== undefined), 'Provide one change.');

export const insightListSchema = z.object({
  search: z.string().trim().max(100).optional(),
  owner: z.enum(['all', 'mine']).default('all'),
  status: z.enum(INSIGHT_STATUSES).default('active'),
  favorite: z.enum(['true', 'false']).optional(),
  cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});
