import { z } from 'zod';
import { dashboardGlobalContextSchema } from './context';

export const DASHBOARD_WIDGET_LIMIT = 12;
export const dashboardCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).default(''),
});
export const dashboardUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(500).optional(),
    globalContext: dashboardGlobalContextSchema.optional(),
  })
  .refine(value => Object.values(value).some(item => item !== undefined), 'Provide one change.');
export const widgetCreateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('insight'),
    insightId: z.uuid(),
    title: z.string().trim().max(200).default(''),
  }),
  z.object({
    kind: z.literal('note'),
    title: z.string().trim().max(200).default(''),
    body: z.string().trim().min(1).max(2000),
  }),
  z.object({
    kind: z.literal('header'),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().max(2000).default(''),
  }),
]);
export const widgetUpdateSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    body: z.string().trim().max(2000).optional(),
    position: z
      .number()
      .int()
      .min(0)
      .max(DASHBOARD_WIDGET_LIMIT - 1)
      .optional(),
    width: z.number().int().min(1).max(3).optional(),
    height: z.number().int().min(1).max(2).optional(),
  })
  .refine(value => Object.values(value).some(item => item !== undefined), 'Provide one change.');
