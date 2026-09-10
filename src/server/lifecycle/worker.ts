import { randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import { getExportWorkerAuth } from '@/server/exports/access';
import { exportDb as db } from '@/server/exports/database';
import { removeArtifact } from '@/server/exports/storage';
import { lifecycleRequestSchema, type LifecycleRequest } from './contracts';
import { type LifecycleJob, requireLifecycleAccess } from './service';

// SQL identifiers are an internal closed list. Every operator value is a bound parameter.
export function lifecyclePlan(projectId: string, input: LifecycleRequest) {
  const cutoff = new Date(input.before);
  const identity = input.target.kind !== 'project';
  const targetId = input.target.kind === 'project' ? null : input.target.id;
  const users =
    input.target.kind === 'account'
      ? Prisma.sql`SELECT u.external_id FROM tracked_user u JOIN account_membership m ON m.tracked_user_id=u.tracked_user_id WHERE u.project_id=${projectId}::uuid AND m.project_id=${projectId}::uuid AND m.tracked_account_id=${targetId}::uuid`
      : Prisma.sql`SELECT external_id FROM tracked_user WHERE project_id=${projectId}::uuid AND tracked_user_id=${targetId}::uuid`;
  const sessions = Prisma.sql`SELECT s.session_id FROM session s WHERE s.website_id=${projectId}::uuid AND (s.distinct_id IN (${users}) OR EXISTS (SELECT 1 FROM session_link l WHERE l.website_id=${projectId}::uuid AND l.session_id=s.session_id AND l.distinct_id IN (${users})))`;
  const scope = (table: string, date = 'created_at') =>
    identity
      ? Prisma.sql`${Prisma.raw(table)}.website_id=${projectId}::uuid AND ${Prisma.raw(table)}.session_id IN (${sessions})`
      : Prisma.sql`${Prisma.raw(table)}.website_id=${projectId}::uuid AND (${Prisma.raw(`${table}.${date}`)} < ${cutoff} OR ${Prisma.raw(`${table}.${date}`)} IS NULL)`;
  const plan: Array<{ table: string; predicate: Prisma.Sql }> = [];
  const include = (category: string) => input.category === 'all' || input.category === category;
  if (include('replay') || include('events')) {
    plan.push({
      table: 'session_replay_saved',
      predicate: identity
        ? Prisma.sql`website_id=${projectId}::uuid AND visit_id IN (SELECT visit_id FROM session_replay WHERE ${scope('session_replay')} UNION SELECT visit_id FROM website_event WHERE ${scope('website_event')})`
        : Prisma.sql`website_id=${projectId}::uuid AND (created_at < ${cutoff} OR created_at IS NULL)`,
    });
    plan.push({ table: 'session_replay', predicate: scope('session_replay') });
  }
  if (include('heatmaps') || include('events'))
    plan.push({ table: 'heatmap_event', predicate: scope('heatmap_event') });
  if (include('properties') || include('events')) {
    plan.push({
      table: 'event_data',
      predicate: Prisma.sql`(${identity ? Prisma.sql`FALSE` : scope('event_data')}) OR website_event_id IN (SELECT event_id FROM website_event WHERE ${scope('website_event')})`,
    });
    plan.push({ table: 'session_data', predicate: scope('session_data') });
  }
  if (include('events')) {
    plan.push({ table: 'revenue', predicate: scope('revenue') });
    plan.push({ table: 'website_event', predicate: scope('website_event') });
    // Keep sessions that still own retained facts. Identity erasure removes the whole
    // linked session, deliberately including anonymous/shared-session evidence.
    const removableSession = identity
      ? Prisma.sql`session_id IN (${sessions})`
      : Prisma.sql`website_id=${projectId}::uuid AND (created_at < ${cutoff} OR created_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM website_event e WHERE e.session_id=session.session_id)
      AND NOT EXISTS (SELECT 1 FROM session_data d WHERE d.session_id=session.session_id)
      AND NOT EXISTS (SELECT 1 FROM revenue r WHERE r.session_id=session.session_id)
      AND NOT EXISTS (SELECT 1 FROM session_replay r WHERE r.session_id=session.session_id)
      AND NOT EXISTS (SELECT 1 FROM heatmap_event h WHERE h.session_id=session.session_id)`;
    // Keep identity-to-session links until the session itself has been removed so
    // subsequent batches can still resolve legacy identities through session_link.
    plan.push({ table: 'session', predicate: removableSession });
    plan.push({
      table: 'session_link',
      predicate: Prisma.sql`website_id=${projectId}::uuid AND NOT EXISTS (SELECT 1 FROM session s WHERE s.session_id=session_link.session_id)`,
    });
  }
  if (input.category === 'all') {
    const userPredicate = identity
      ? input.target.kind === 'account'
        ? Prisma.sql`project_id=${projectId}::uuid AND tracked_user_id IN (SELECT tracked_user_id FROM account_membership WHERE project_id=${projectId}::uuid AND tracked_account_id=${targetId}::uuid)`
        : Prisma.sql`project_id=${projectId}::uuid AND tracked_user_id=${targetId}::uuid`
      : Prisma.sql`project_id=${projectId}::uuid AND last_seen_at < ${cutoff} AND NOT EXISTS (SELECT 1 FROM session s WHERE s.website_id=${projectId}::uuid AND s.distinct_id=tracked_user.external_id) AND NOT EXISTS (SELECT 1 FROM session_link l WHERE l.website_id=${projectId}::uuid AND l.distinct_id=tracked_user.external_id)`;
    // Raw SQL is intentional: relationMode=prisma does not add identity FKs.
    // Membership cleanup follows users, retaining account resolution until deletion.
    plan.push({ table: 'tracked_user', predicate: userPredicate });
    plan.push({
      table: 'account_membership',
      predicate: Prisma.sql`project_id=${projectId}::uuid AND NOT EXISTS (SELECT 1 FROM tracked_user u WHERE u.tracked_user_id=account_membership.tracked_user_id)`,
    });
    if (input.target.kind !== 'user')
      plan.push({
        table: 'tracked_account',
        predicate:
          input.target.kind === 'account'
            ? Prisma.sql`project_id=${projectId}::uuid AND tracked_account_id=${targetId}::uuid`
            : Prisma.sql`project_id=${projectId}::uuid AND last_seen_at < ${cutoff} AND NOT EXISTS (SELECT 1 FROM account_membership m WHERE m.tracked_account_id=tracked_account.tracked_account_id)`,
      });
  }
  return plan;
}

export async function runLifecycleOnce(): Promise<boolean> {
  let claimedId: string | undefined;
  return db
    .$transaction(
      async tx => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
        const rows = await tx.$queryRaw<
          LifecycleJob[]
        >`SELECT * FROM data_lifecycle_job WHERE status IN ('queued','running') ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
        const job = rows[0];
        if (!job) return false;
        claimedId = job.id;
        const lock = await tx.$queryRaw<
          Array<{ acquired: boolean }>
        >`SELECT pg_try_advisory_xact_lock(hashtext(${`lifecycle:${job.project_id}`})) AS acquired`;
        if (!lock[0]?.acquired) return false;
        const finish = async (status: string, code: string | null) => {
          await tx.$executeRaw`UPDATE data_lifecycle_job SET status=${status}, error_code=${code}, updated_at=now(), completed_at=now() WHERE id=${job.id}::uuid`;
          await tx.securityAuditEvent.create({
            data: {
              id: randomUUID(),
              actorUserId: job.requester_id,
              eventType: `lifecycle.${status}`,
              outcome: status === 'completed' ? 'success' : 'blocked',
              metadata: {
                jobId: job.id,
                projectId: job.project_id,
                deletedRows: job.deleted_rows,
                code,
              },
            },
          });
          console.info(
            JSON.stringify({
              event: 'lifecycle.job',
              jobId: job.id,
              outcome: status,
              code,
              deletedRows: job.deleted_rows,
            }),
          );
        };
        try {
          const auth = await getExportWorkerAuth(job.requester_id, job.session_version);
          await requireLifecycleAccess(auth, job.project_id);
        } catch {
          await finish('blocked', 'lifecycle-access-revoked');
          return true;
        }
        if (process.env.CLICKHOUSE_URL || process.env.CLOUD_MODE || process.env.KAFKA_BROKER) {
          await finish('blocked', 'lifecycle-unsupported-store');
          return true;
        }
        const input = lifecycleRequestSchema.parse(job.definition);
        const plan = lifecyclePlan(job.project_id, input);
        if (job.step === 0) {
          // A running export may hold an old snapshot. Never erase its DB key while it
          // can still write an artifact. Operator retries after that job terminates.
          const running = await tx.exportJob.findFirst({
            where: { projectId: job.project_id, status: 'running' },
            select: { id: true },
          });
          if (running) {
            await finish('blocked', 'lifecycle-export-running');
            return true;
          }
          const exports = await tx.exportJob.findMany({
            where: { projectId: job.project_id },
            take: 100,
            orderBy: { id: 'asc' },
          });
          for (const item of exports) {
            if (item.artifactKey) await removeArtifact(item.artifactKey);
            await tx.exportJob.delete({ where: { id: item.id } });
          }
          if (exports.length) {
            await tx.$executeRaw`UPDATE data_lifecycle_job SET status='running', deleted_rows=deleted_rows+${exports.length}, updated_at=now() WHERE id=${job.id}::uuid`;
            return true;
          }
        }
        const step = plan[job.step - 1];
        if (job.step > 0 && !step) {
          // Every predicate must now be empty. This also catches late-arriving events
          // before reporting physical completion; no resetAt-only success.
          for (const entry of plan) {
            const remaining = await tx.$queryRaw<Array<{ present: boolean }>>(
              Prisma.sql`SELECT EXISTS(SELECT 1 FROM ${Prisma.raw(entry.table)} WHERE ${entry.predicate} LIMIT 1) AS present`,
            );
            if (remaining[0]?.present) {
              await finish('blocked', 'lifecycle-data-changed-retry');
              return true;
            }
          }
          await finish('completed', null);
          return true;
        }
        let count = 0;
        if (step)
          count = await tx.$executeRaw(
            Prisma.sql`DELETE FROM ${Prisma.raw(step.table)} WHERE ctid IN (SELECT ctid FROM ${Prisma.raw(step.table)} WHERE ${step.predicate} LIMIT 500)`,
          );
        await tx.$executeRaw`UPDATE data_lifecycle_job SET status='running', step=step+${count === 0 ? 1 : 0}, deleted_rows=deleted_rows+${count}, updated_at=now() WHERE id=${job.id}::uuid`;
        return true;
      },
      { timeout: 20_000, maxWait: 5_000 },
    )
    .catch(async () => {
      if (!claimedId) throw new Error('lifecycle-database-unavailable');
      await db.$executeRaw`UPDATE data_lifecycle_job SET status='failed', error_code='lifecycle-batch-failed', updated_at=now(), completed_at=now() WHERE id=${claimedId}::uuid AND status IN ('queued','running')`;
      console.info(
        JSON.stringify({
          event: 'lifecycle.job',
          jobId: claimedId,
          outcome: 'failed',
          code: 'lifecycle-batch-failed',
        }),
      );
      return true;
    });
}
