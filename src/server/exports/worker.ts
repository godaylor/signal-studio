import { randomUUID } from 'node:crypto';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { getExportWorkerAuth, requireExportAccess } from './access';
import { EXPORT_LIMITS, ExportError } from './contracts';
import { exportDb } from './database';
import { exportDataset } from './dataset';
import { encodeExport } from './format';
import { auditExport, normalizeExport } from './service';
import { removeArtifact, writeArtifact } from './storage';

export async function cleanupExports(now = new Date(), limit = 100) {
  // Batches bound both DB reads and filesystem work for a busy installation.
  const expired = await exportDb.exportJob.findMany({
    where: { expiresAt: { lte: now }, status: { not: 'expired' } },
    take: limit,
    orderBy: { expiresAt: 'asc' },
  });
  for (const job of expired) {
    if (job.artifactKey) await removeArtifact(job.artifactKey);
    await exportDb.exportJob.updateMany({
      where: { id: job.id, expiresAt: { lte: now } },
      data: { status: 'expired', artifactKey: null },
    });
  }
  // Unknown files are never removed. Only artifact keys owned by expired DB jobs are cleaned.
  await exportDb.exportJob.updateMany({
    where: {
      status: 'running',
      attempts: { gte: EXPORT_LIMITS.maxAttempts },
      startedAt: { lt: new Date(now.getTime() - EXPORT_LIMITS.leaseMs) },
    },
    data: { status: 'failed', errorCode: 'export-worker-attempts-exhausted', completedAt: now },
  });
}

export async function runExportOnce(jobId?: string): Promise<boolean> {
  const leaseId = randomUUID();
  const now = new Date();
  const stale = new Date(now.getTime() - EXPORT_LIMITS.leaseMs);
  const claimed = await exportDb.$queryRaw<Array<{ id: string; previousKey: string | null }>>`
    WITH candidate AS (SELECT id, artifact_key FROM export_job
      WHERE expires_at > ${now} AND attempts < ${EXPORT_LIMITS.maxAttempts}
        AND (${jobId ?? null}::uuid IS NULL OR id = ${jobId ?? null}::uuid)
        AND (status = 'queued' OR (status = 'running' AND started_at < ${stale}))
      ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1)
    UPDATE export_job AS job SET status = 'running', lease_id = ${leaseId}::uuid,
      artifact_key = job.id::text || '.' || ${leaseId} || '.bin',
      started_at = ${now}, attempts = job.attempts + 1, error_code = NULL
    FROM candidate WHERE job.id = candidate.id
    RETURNING job.id, candidate.artifact_key AS "previousKey"`;
  if (!claimed.length) return false;
  const job = await exportDb.exportJob.findUniqueOrThrow({ where: { id: claimed[0].id } });
  const artifactKey = `${job.id}.${leaseId}.bin`;
  const started = Date.now();
  let rowCount = 0;
  let byteCount = 0;
  try {
    // The previous key comes from this locked DB job, never from a directory scan.
    // Persisting the new key before writing also makes interrupted writes owned/cleanable.
    if (claimed[0].previousKey) await removeArtifact(claimed[0].previousKey);
    const definition = normalizeExport(job.definition, job.projectId);
    const auth = await getExportWorkerAuth(job.requesterId, job.sessionVersion);
    const access = await requireExportAccess(auth, job.projectId, definition);
    if (access.permissionScope !== job.permissionScope)
      throw new ExportError('export-scope-changed', 403);
    const write = async (client?: Parameters<typeof exportDataset>[3]) => {
      const dataset = await exportDataset(definition, access, job.id, client);
      await writeArtifact(
        artifactKey,
        encodeExport(
          dataset,
          definition.format,
          { rows: EXPORT_LIMITS.jobRows, bytes: process.env.SIGNAL_STUDIO_SERVERLESS === '1' ? 3 * 1024 * 1024 : EXPORT_LIMITS.jobBytes },
          (rows, bytes) => {
            if (process.env.SIGNAL_STUDIO_SERVERLESS === '1' && Date.now() - started > 150_000)
              throw new ExportError('export-time-limit', 413);
            rowCount = rows;
            byteCount = bytes;
          },
        ),
      );
    };
    if (definition.source.kind === 'analysis') await write();
    else
      await exportDb.$transaction(
        async tx => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
          await write(tx);
        },
        { isolationLevel: 'RepeatableRead', timeout: process.env.SIGNAL_STUDIO_SERVERLESS === '1' ? 120_000 : 240_000, maxWait: 5_000 },
      );
    const currentAuth = await getExportWorkerAuth(job.requesterId, job.sessionVersion);
    const current = await requireExportAccess(currentAuth, job.projectId, definition);
    if (current.permissionScope !== job.permissionScope)
      throw new ExportError('export-scope-changed', 403);
    const published = await exportDb.exportJob.updateMany({
      where: { id: job.id, leaseId, status: 'running', expiresAt: { gt: new Date() } },
      data: { status: 'completed', artifactKey, rowCount, byteCount, completedAt: new Date() },
    });
    if (!published.count) await removeArtifact(artifactKey);
    else await auditExport(job, definition, 'completed', 'success');
    console.info(
      JSON.stringify({
        event: 'export.job',
        jobId: job.id,
        outcome: published.count ? 'completed' : 'discarded',
        rows: rowCount,
        bytes: byteCount,
        durationMs: Date.now() - started,
      }),
    );
  } catch (error) {
    await removeArtifact(artifactKey);
    const code = error instanceof ExportError ? error.code : 'export-job-failed';
    await exportDb.exportJob.updateMany({
      where: { id: job.id, leaseId, status: 'running' },
      data: { status: 'failed', errorCode: code, completedAt: new Date() },
    });
    await recordSecurityAuditEvent({ actorUserId: job.requesterId, eventType: 'export.failed', outcome: 'failure', metadata: { jobId: job.id, projectId: job.projectId, scope: job.permissionScope, code } });
    console.info(
      JSON.stringify({
        event: 'export.job',
        jobId: job.id,
        outcome: 'failed',
        code,
        durationMs: Date.now() - started,
      }),
    );
  }
  return true;
}
