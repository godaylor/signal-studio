import { randomUUID } from 'node:crypto';
import type { Auth } from '@/lib/types';
import { exportDb as db } from '@/server/exports/database';
import { resolveProjectAccess } from '@/server/permissions/capabilities';
import { LifecycleError, lifecycleRequestSchema } from './contracts';

export interface LifecycleJob {
  id: string;
  project_id: string;
  requester_id: string;
  session_version: number;
  definition: unknown;
  status: string;
  step: number;
  deleted_rows: number;
  error_code: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}
export async function requireLifecycleAccess(auth: Auth, projectId: string) {
  const access = await resolveProjectAccess(auth, projectId);
  if (!access?.capabilities.manageWorkspaceSecurity)
    throw new LifecycleError('lifecycle-access-denied', 403);
  return access;
}
export function lifecycleDto(job: LifecycleJob) {
  return {
    id: job.id,
    definition: job.definition,
    status: job.status,
    step: job.step,
    deletedRows: job.deleted_rows,
    errorCode: job.error_code,
    createdAt: job.created_at,
    completedAt: job.completed_at,
    stores: ['postgresql', 'owned-export-files'],
    excludedStores: ['operator-backups', 'previously-downloaded-files'],
    cacheExpiresWithinSeconds: 120,
  };
}
export async function listLifecycle(auth: Auth, projectId: string) {
  await requireLifecycleAccess(auth, projectId);
  const jobs = await db.$queryRaw<
    LifecycleJob[]
  >`SELECT * FROM data_lifecycle_job WHERE project_id = ${projectId}::uuid ORDER BY created_at DESC, id DESC LIMIT 50`;
  return jobs.map(lifecycleDto);
}
export async function createLifecycle(auth: Auth, projectId: string, input: unknown) {
  await requireLifecycleAccess(auth, projectId);
  const definition = lifecycleRequestSchema.parse(input);
  if (definition.confirmProjectId !== projectId)
    throw new LifecycleError('lifecycle-confirmation-mismatch');
  const actor = await db.user.findFirst({
    where: { id: auth.user.id, deletedAt: null },
    select: { sessionVersion: true },
  });
  if (!actor) throw new LifecycleError('lifecycle-access-denied', 403);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId}))::text`;
    const project = await tx.$queryRaw<Array<{ website_id: string }>>`SELECT website_id FROM website WHERE website_id=${projectId}::uuid AND deleted_at IS NULL FOR KEY SHARE`;
    if (!project.length) throw new LifecycleError('lifecycle-project-not-found', 404);
    const existing = await tx.$queryRaw<
      LifecycleJob[]
    >`SELECT * FROM data_lifecycle_job WHERE project_id=${projectId}::uuid AND requester_id=${auth.user.id}::uuid AND idempotency_key=${definition.idempotencyKey}::uuid`;
    if (existing[0]) {
      if (
        JSON.stringify(lifecycleRequestSchema.parse(existing[0].definition)) !==
        JSON.stringify(definition)
      )
        throw new LifecycleError('lifecycle-idempotency-conflict', 409);
      return lifecycleDto(existing[0]);
    }
    if (definition.target.kind !== 'project') {
      const target = definition.target.kind === 'user'
        ? await tx.trackedUser.findFirst({ where: { id: definition.target.id, projectId }, select: { id: true } })
        : await tx.trackedAccount.findFirst({ where: { id: definition.target.id, projectId }, select: { id: true } });
      if (!target) throw new LifecycleError('lifecycle-target-not-found', 404);
    }
    const pending = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM data_lifecycle_job WHERE project_id=${projectId}::uuid AND status IN ('queued','running') LIMIT 1`;
    if (pending.length) throw new LifecycleError('lifecycle-already-active', 409);
    const id = randomUUID();
    const jobs = await tx.$queryRaw<
      LifecycleJob[]
    >`INSERT INTO data_lifecycle_job (id,project_id,requester_id,session_version,idempotency_key,definition) VALUES (${id}::uuid,${projectId}::uuid,${auth.user.id}::uuid,${actor.sessionVersion},${definition.idempotencyKey}::uuid,${JSON.stringify(definition)}::jsonb) RETURNING *`;
    await tx.securityAuditEvent.create({
      data: {
        id: randomUUID(),
        actorUserId: auth.user.id,
        eventType: 'lifecycle.requested',
        outcome: 'success',
        metadata: {
          jobId: id,
          projectId,
          category: definition.category,
          targetKind: definition.target.kind,
        },
      },
    });
    return lifecycleDto(jobs[0]);
  });
}
