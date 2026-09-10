import { z } from 'zod';

export const sessionEvidenceQuerySchema = z
  .object({
    sessionId: z.string().uuid(),
    cursor: z.string().max(2048).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    returnTo: z.string().max(4096).optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    urlPath: z.string().max(500).optional(),
  })
  .refine(
    value => !value.startAt || !value.endAt || new Date(value.startAt) < new Date(value.endAt),
    'Evidence range must be ordered.',
  )
  .refine(
    value =>
      !value.startAt ||
      !value.endAt ||
      new Date(value.endAt).getTime() - new Date(value.startAt).getTime() <= 366 * 86_400_000,
    'Evidence range cannot exceed 366 days.',
  );

export type SessionEvidenceQuery = z.infer<typeof sessionEvidenceQuerySchema>;

export function safeEvidenceReturnTo(projectId: string, value?: string) {
  if (!value) return `/studio/${projectId}/audiences`;
  const expected = `/studio/${projectId}/`;
  return value.startsWith(expected) && !value.startsWith('//')
    ? value
    : `/studio/${projectId}/audiences`;
}
