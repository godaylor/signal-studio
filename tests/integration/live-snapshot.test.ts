import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { createLiveSnapshotService } from '@/server/live/live-snapshot-service';
import { upsertTrackedIdentity } from '@/server/identities/upsert';
import { seedGoldenPostgres } from './fixtures/golden-postgres';

describe('LiveSnapshot PostgreSQL reference', () => {
  let projectId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ websiteId: projectId, cleanup } = await seedGoldenPostgres());
    await upsertTrackedIdentity({
      projectId,
      externalId: 'visitor-alice',
      account: { id: 'acme', name: 'Acme' },
      observedAt: new Date('2026-03-07T15:10:00.000Z'),
    });
  });

  afterAll(async () => {
    await prisma.client.accountMembership.deleteMany({ where: { projectId } });
    await prisma.client.trackedUser.deleteMany({ where: { projectId } });
    await prisma.client.trackedAccount.deleteMany({ where: { projectId } });
    await cleanup?.();
    await prisma.client.$disconnect();
  });

  test('returns one bounded exact PostgreSQL snapshot with identified activity', async () => {
    const service = createLiveSnapshotService({ now: () => new Date('2026-03-07T15:15:00.000Z').getTime() });
    const snapshot = await service.execute({ projectId, tenantId: projectId, permissionScope: 'identity-sensitive' });

    expect(snapshot.range).toMatchObject({ start: '2026-03-07T14:45:00.000Z', end: '2026-03-07T15:15:00.000Z', boundary: '[start,end)', timezone: 'UTC' });
    expect(snapshot.freshnessAt).toBe('2026-03-07T15:10:00.000Z');
    expect(snapshot.totals).toMatchObject({ activeUsers: 1, activeAccounts: 1 });
    expect(snapshot.activity.length).toBeGreaterThan(0);
    expect(snapshot.activity.length).toBeLessThanOrEqual(100);
  });
});
