import { z } from 'zod';

export const lifecycleRequestSchema = z
  .object({
    version: z.literal(1),
    idempotencyKey: z.uuid(),
    category: z.enum(['events', 'properties', 'replay', 'heatmaps', 'exports', 'all']),
    target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('project') }).strict(),
      z.object({ kind: z.literal('user'), id: z.uuid() }).strict(),
      z.object({ kind: z.literal('account'), id: z.uuid() }).strict(),
    ]),
    before: z.iso.datetime({ offset: true }),
    confirmProjectId: z.uuid(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Date(value.before).getTime() > Date.now())
      ctx.addIssue({ code: 'custom', path: ['before'], message: 'Future cutoff is not allowed' });
    if (value.target.kind !== 'project' && value.category !== 'all')
      ctx.addIssue({ code: 'custom', message: 'Identity erasure must cover all categories' });
  });
export type LifecycleRequest = z.infer<typeof lifecycleRequestSchema>;
export class LifecycleError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
