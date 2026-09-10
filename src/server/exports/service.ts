import { createHash, randomUUID } from 'node:crypto';
import type { ExportJob } from '@/generated/prisma/client';
import type { Auth } from '@/lib/types';
import { normalizeAnalysisQuery } from '@/server/analytics/normalize';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { getExportWorkerAuth, requireExportAccess } from './access';
import {
  type CreateExport,
  EXPORT_LIMITS,
  type ExportDefinition,
  ExportError,
  type ExportJobDto,
  type ExportStatus,
  exportDefinitionSchema,
} from './contracts';
import { exportDb } from './database';
import { exportDataset } from './dataset';
import { encodeExport, exportFilename } from './format';
import { readArtifact } from './storage';

export function normalizeExport(input: unknown, projectId: string): ExportDefinition {
  const definition = exportDefinitionSchema.parse(input);
  if (definition.source.kind === 'analysis') {
    definition.source.query = normalizeAnalysisQuery(definition.source.query);
    if (definition.source.query.projectId !== projectId)
      throw new ExportError('export-project-mismatch', 403);
  } else if (definition.allRows) {
    delete definition.source.list.cursor;
  }
  return definition;
}

export function exportJobDto(job: ExportJob): ExportJobDto {
  return {
    id: job.id,
    filename: job.filename,
    status: job.expiresAt.getTime() <= Date.now() ? 'expired' : (job.status as ExportStatus),
    rowCount: job.rowCount,
    byteCount: job.byteCount,
    createdAt: job.createdAt.toISOString(),
    expiresAt: job.expiresAt.toISOString(),
    errorCode: job.errorCode,
  };
}

export async function auditExport(
  job: Pick<ExportJob, 'id' | 'projectId' | 'requesterId' | 'permissionScope'>,
  definition: ExportDefinition,
  event: string,
  outcome: 'success' | 'failure' | 'blocked',
) {
  await recordSecurityAuditEvent({
    actorUserId: job.requesterId,
    eventType: `export.${event}`,
    outcome,
    metadata: {
      jobId: job.id,
      projectId: job.projectId,
      scope: job.permissionScope,
      format: definition.format,
      source: definition.source.kind,
      allRows: definition.allRows,
    },
  });
}

export async function createExport(
  auth: Auth,
  projectId: string,
  input: CreateExport,
  requestId: string,
) {
  const definition = normalizeExport(input, projectId);
  const access = await requireExportAccess(auth, projectId, definition);
  const project = await exportDb.website.findUniqueOrThrow({
    where: { id: projectId },
    select: { name: true },
  });
  const filename = exportFilename(project.name, definition);
  if (!definition.allRows) {
    try {
      const dataset = await exportDataset(definition, access, requestId);
      const chunks: Buffer[] = [];
      for await (const chunk of encodeExport(dataset, definition.format, {
        rows: EXPORT_LIMITS.syncRows,
        bytes: EXPORT_LIMITS.syncBytes,
      }))
        chunks.push(chunk);
      const current = await requireExportAccess(auth, projectId, definition);
      if (current.permissionScope !== access.permissionScope)
        throw new ExportError('export-scope-changed', 403);
      await auditExport(
        {
          id: requestId,
          projectId,
          requesterId: access.actorUserId,
          permissionScope: access.permissionScope,
        },
        definition,
        'downloaded',
        'success',
      );
      return {
        kind: 'download' as const,
        filename,
        format: definition.format,
        data: Buffer.concat(chunks),
      };
    } catch (error) {
      if (!(error instanceof ExportError) || error.status !== 413) throw error;
    }
  }
  const definitionHash = createHash('sha256').update(JSON.stringify(definition)).digest('hex');
  const job = await exportDb.$transaction(async tx => {
    // Serialize quota/idempotency decisions for this requester without table locks.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${access.actorUserId}, 15))::text`;
    const existing = await tx.exportJob.findUnique({
      where: {
        projectId_requesterId_idempotencyKey: {
          projectId,
          requesterId: access.actorUserId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (
        existing.definitionHash !== definitionHash ||
        existing.permissionScope !== access.permissionScope
      )
        throw new ExportError('export-idempotency-conflict', 409);
      return existing;
    }
    const active = await tx.exportJob.count({
      where: {
        requesterId: access.actorUserId,
        status: { in: ['queued', 'running'] },
        expiresAt: { gt: new Date() },
      },
    });
    if (active >= EXPORT_LIMITS.activePerUser) throw new ExportError('export-active-limit', 429);
    const user = await tx.user.findUniqueOrThrow({
      where: { id: access.actorUserId },
      select: { sessionVersion: true },
    });
    return tx.exportJob.create({
      data: {
        id: randomUUID(),
        projectId,
        requesterId: access.actorUserId,
        idempotencyKey: input.idempotencyKey,
        definitionHash,
        definition,
        permissionScope: access.permissionScope,
        sessionVersion: user.sessionVersion,
        filename,
        expiresAt: new Date(Date.now() + EXPORT_LIMITS.ttlMs),
      },
    });
  });
  await auditExport(job, definition, 'requested', 'success');
  return { kind: 'job' as const, job: exportJobDto(job) };
}

export async function listExportJobs(auth: Auth, projectId: string) {
  const access = await requireExportAccess(auth, projectId);
  const jobs = await exportDb.exportJob.findMany({
    where: { projectId, requesterId: access.actorUserId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 30,
  });
  return jobs.map(exportJobDto);
}

async function ownedJob(auth: Auth, projectId: string, id: string) {
  const access = await requireExportAccess(auth, projectId);
  const job = await exportDb.exportJob.findFirst({
    where: { id, projectId, requesterId: access.actorUserId },
  });
  if (!job) throw new ExportError('export-not-found', 404);
  return job;
}

export async function downloadExport(auth: Auth, projectId: string, id: string) {
  const job = await ownedJob(auth, projectId, id);
  const definition = normalizeExport(job.definition, projectId);
  const access = await requireExportAccess(auth, projectId, definition);
  await getExportWorkerAuth(job.requesterId, job.sessionVersion);
  if (access.permissionScope !== job.permissionScope)
    throw new ExportError('export-scope-changed', 403);
  if (job.expiresAt.getTime() <= Date.now()) throw new ExportError('export-expired', 410);
  if (job.status !== 'completed' || !job.artifactKey)
    throw new ExportError('export-not-ready', 409);
  const data = await readArtifact(job.artifactKey);
  await auditExport(job, definition, 'downloaded', 'success');
  return { filename: job.filename, format: definition.format, data };
}

export async function cancelExport(auth: Auth, projectId: string, id: string) {
  const job = await ownedJob(auth, projectId, id);
  await exportDb.exportJob.updateMany({
    where: { id: job.id, status: { in: ['queued', 'running'] } },
    data: { status: 'cancelled', completedAt: new Date() },
  });
  await auditExport(job, normalizeExport(job.definition, projectId), 'cancelled', 'success');
}
