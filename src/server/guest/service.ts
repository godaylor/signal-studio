import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import { hash } from '@/lib/crypto';
import { getIpAddress } from '@/lib/ip';
import { hashPassword } from '@/lib/password';
import { serializeAnalysisQuery } from '@/server/analytics/url-codec';
import { GuestError, GUEST_LIMITS } from './contracts';
import { getGuestDatabase } from './database';
import { guestDatasetRange, seedGuestDataset } from './dataset';
import { guestSessionInfo, guestTokenHash, resolveGuestSession } from './session';

export async function startGuestSession(request: Request, now = new Date()) {
  if (process.env.GUEST_ACCESS_DISABLED === '1') throw new GuestError('guest-disabled', 503);
  const existing = await resolveGuestSession(request, now);
  if (existing) {
    const guest = guestSessionInfo(existing.session);
    return {
      user: existing.user,
      guest,
      redirect: `/studio/${guest.projectId}/explore?${serializeAnalysisQuery(guest.defaultQuery)}`,
      token: null,
    };
  }
  const db = getGuestDatabase();
  await cleanupExpiredGuests(now, 3);
  const token = randomBytes(32).toString('hex');
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const { start, end } = guestDatasetRange(now);
  const clientKey = `client:${hash('guest-entry', getIpAddress(request.headers) || 'direct').slice(0, 64)}`;
  const result = await db.$transaction(
    async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('signal-studio-guest-entry', 37))::text`;
      for (const [key, windowMs, maximum] of [
        ['global', 60_000, GUEST_LIMITS.startsPerMinute],
        [clientKey, 3_600_000, GUEST_LIMITS.startsPerClientHour],
      ] as const) {
        const previous = await tx.guestEntryLimit.findUnique({ where: { key } });
        const current = previous && now.getTime() - previous.windowStartedAt.getTime() < windowMs;
        if (current && previous.attempts >= maximum) {
          throw new GuestError(
            'guest-entry-limited',
            429,
            Math.ceil((previous.windowStartedAt.getTime() + windowMs - now.getTime()) / 1000),
          );
        }
        await tx.guestEntryLimit.upsert({
          where: { key },
          create: { key, windowStartedAt: now, attempts: 1 },
          update: {
            windowStartedAt: current ? previous.windowStartedAt : now,
            attempts: current ? previous.attempts + 1 : 1,
          },
        });
      }
      const active = await tx.guestSession.count({ where: { expiresAt: { gt: now } } });
      if (active >= GUEST_LIMITS.activeWorkspaces)
        throw new GuestError('guest-capacity-reached', 429, 300);
      // Compute the credential only after the shared creation limits pass.
      const password = hashPassword(randomBytes(32).toString('hex'));
      const user = await tx.user.create({
        data: {
          id: userId,
          username: `guest-${userId}`,
          displayName: 'Гость',
          password,
          role: 'guest',
        },
        select: { id: true, username: true, displayName: true, role: true, createdAt: true },
      });
      await tx.team.create({ data: { id: workspaceId, name: 'Личное гостевое пространство' } });
      await tx.teamUser.create({
        data: {
          id: randomUUID(),
          teamId: workspaceId,
          userId,
          role: 'team-member',
          studioRole: 'analyst',
          capabilityOverrides: { exportData: true },
        },
      });
      // Ownership remains at the team boundary so the guest cannot inherit owner's broad capabilities.
      await tx.website.create({
        data: {
          id: projectId,
          name: 'Orbit · синтетические данные',
          domain: 'synthetic.example',
          teamId: workspaceId,
          createdBy: userId,
        },
      });
      await seedGuestDataset(tx, projectId, userId, start, end);
      const session = await tx.guestSession.create({
        data: {
          id: randomUUID(),
          tokenHash: guestTokenHash(token),
          userId,
          workspaceId,
          projectId,
          createdAt: now,
          expiresAt: new Date(now.getTime() + GUEST_LIMITS.lifetimeSeconds * 1000),
          datasetStartAt: start,
          datasetEndAt: end,
          windowStartedAt: now,
        },
      });
      return { user: { ...user, isAdmin: false, isGuest: true }, guest: guestSessionInfo(session) };
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
  console.info(
    JSON.stringify({ event: 'guest.created', projectId, outcome: 'success', synthetic: true }),
  );
  return {
    ...result,
    token,
    redirect: `/studio/${projectId}/explore?${serializeAnalysisQuery(result.guest.defaultQuery)}`,
  };
}

// Every target is obtained from an expired guest_session row, never a caller's arbitrary project ID.
// The finite fixture and lifetime creation quotas bound each cleanup transaction.
export async function cleanupExpiredGuests(now = new Date(), limit = 10) {
  const db = getGuestDatabase();
  const batch = Math.min(50, Math.max(1, limit));
  const expired = await db.$queryRaw<Array<{ id: string }>>`SELECT id FROM guest_session
    WHERE expires_at<=${now} AND operations->>'purged' IS DISTINCT FROM 'true'
    ORDER BY expires_at,id LIMIT ${batch}`;
  for (const { id } of expired) {
    await db.$transaction(
      async tx => {
        const rows = await tx.$queryRaw<
          Array<{ project_id: string; user_id: string; workspace_id: string }>
        >`
        SELECT project_id,user_id,workspace_id FROM guest_session WHERE id=${id}::uuid AND expires_at<=${now}
        AND operations->>'purged' IS DISTINCT FROM 'true' FOR UPDATE SKIP LOCKED`;
        const row = rows[0];
        if (!row) return;
        const projectId = row.project_id;
        // Guest export is synchronous only; it never creates durable artifacts or background jobs.
        await tx.$executeRaw`DELETE FROM studio_dashboard_widget WHERE dashboard_id IN (SELECT id FROM studio_dashboard WHERE project_id=${projectId}::uuid)`;
        for (const table of [
          'studio_dashboard',
          'insight',
          'account_membership',
          'tracked_user',
          'tracked_account',
        ]) {
          await tx.$executeRaw(
            Prisma.sql`DELETE FROM ${Prisma.raw(table)} WHERE project_id=${projectId}::uuid`,
          );
        }
        for (const table of [
          'event_data',
          'session_data',
          'revenue',
          'website_event',
          'session_link',
          'session',
          'segment',
        ]) {
          await tx.$executeRaw(
            Prisma.sql`DELETE FROM ${Prisma.raw(table)} WHERE website_id=${projectId}::uuid`,
          );
        }
        await tx.$executeRaw`DELETE FROM security_audit_event WHERE actor_user_id=${row.user_id}::uuid`;
        await tx.$executeRaw`DELETE FROM website WHERE website_id=${projectId}::uuid AND team_id=${row.workspace_id}::uuid`;
        await tx.$executeRaw`DELETE FROM team_user WHERE team_id=${row.workspace_id}::uuid AND user_id=${row.user_id}::uuid`;
        await tx.$executeRaw`DELETE FROM team WHERE team_id=${row.workspace_id}::uuid`;
        await tx.$executeRaw`DELETE FROM "user" WHERE user_id=${row.user_id}::uuid AND role='guest'`;
        // A 24h tombstone prevents cached public-source metadata from re-opening
        // ingestion after removal. No workspace data or usable credential survives.
        await tx.guestSession.update({
          where: { id },
          data: {
            tokenHash: guestTokenHash(randomBytes(32).toString('hex')),
            operations: { purged: true },
          },
        });
      },
      { timeout: 15_000 },
    );
  }
  await db.guestEntryLimit.deleteMany({
    where: { windowStartedAt: { lt: new Date(now.getTime() - 86_400_000) } },
  });
  const tombstoneCutoff = new Date(now.getTime() - 86_400_000);
  await db.$executeRaw`DELETE FROM guest_session WHERE expires_at<${tombstoneCutoff} AND operations->>'purged'='true'`;
  return expired.length;
}
