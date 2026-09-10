import { z } from 'zod';
import { analysisQueryV1Schema } from '@/server/analytics/contracts';
import { identityListQuerySchema } from '@/server/audiences/contracts';

export const EXPORT_LIMITS = Object.freeze({
  syncRows: 1000,
  syncBytes: 1024 * 1024,
  jobRows: 100_000,
  jobBytes: 64 * 1024 * 1024,
  ttlMs: 60 * 60 * 1000,
  leaseMs: 5 * 60 * 1000,
  maxAttempts: 3,
  activePerUser: 3,
});

export const exportDefinitionSchema = z.object({
  version: z.literal(1),
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('analysis'), query: analysisQueryV1Schema }),
    z.object({
      kind: z.literal('users'),
      list: identityListQuerySchema,
      visibleRows: z.number().int().min(1).max(100_000).optional(),
    }),
    z.object({
      kind: z.literal('accounts'),
      list: identityListQuerySchema,
      visibleRows: z.number().int().min(1).max(100_000).optional(),
    }),
  ]),
  format: z.enum(['csv', 'json']),
  allRows: z.boolean().default(false),
});
export const createExportSchema = exportDefinitionSchema.extend({ idempotencyKey: z.uuid() });
export type ExportDefinition = z.infer<typeof exportDefinitionSchema>;
export type CreateExport = z.infer<typeof createExportSchema>;
export type ExportStatus = 'queued' | 'running' | 'completed' | 'failed' | 'expired' | 'cancelled';
export interface ExportJobDto {
  id: string;
  filename: string;
  status: ExportStatus;
  rowCount: number;
  byteCount: number;
  createdAt: string;
  expiresAt: string;
  errorCode: string | null;
}
export class ExportError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
