import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { deleteWebsite, resetWebsite } from '@/queries/prisma/website';
import { upsertTrackedIdentity } from '@/server/identities/upsert';

describe('PostgreSQL tracked identity projection', () => {
  const firstProjectId = randomUUID();
  const secondProjectId = randomUUID();

  beforeAll(async () => {
    await prisma.client.website.createMany({
      data: [
        { id: firstProjectId, name: 'Identity project one', domain: 'one.identity.test' },
        { id: secondProjectId, name: 'Identity project two', domain: 'two.identity.test' },
      ],
    });
  });

  afterAll(async () => {
    for (const projectId of [firstProjectId, secondProjectId]) {
      await prisma.client.accountMembership.deleteMany({ where: { projectId } });
      await prisma.client.trackedUser.deleteMany({ where: { projectId } });
      await prisma.client.trackedAccount.deleteMany({ where: { projectId } });
      await prisma.client.sessionReplay.deleteMany({ where: { websiteId: projectId } });
      await prisma.client.heatmapEvent.deleteMany({ where: { websiteId: projectId } });
      await prisma.client.session.deleteMany({ where: { websiteId: projectId } });
      await prisma.client.website.deleteMany({ where: { id: projectId } });
    }
    await prisma.client.$disconnect();
  });

  test('is idempotent under repeated and concurrent same-ID observations', async () => {
    const observedAt = new Date('2026-03-10T10:00:00.000Z');
    const input = {
      projectId: firstProjectId,
      externalId: 'shared-user',
      traits: { plan: 'pro', email: 'shared@example.test' },
      account: { id: 'acme', name: 'Acme', traits: { industry: 'software' } },
      observedAt,
    };

    const results = await Promise.all([
      upsertTrackedIdentity(input),
      upsertTrackedIdentity(input),
      upsertTrackedIdentity(input),
    ]);

    expect(new Set(results.map(result => result?.trackedUserId))).toHaveLength(1);
    await expect(
      prisma.client.trackedUser.count({
        where: { projectId: firstProjectId, externalId: 'shared-user' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.client.accountMembership.count({
        where: { projectId: firstProjectId },
      }),
    ).resolves.toBe(1);
  });

  test('scopes duplicate external IDs by project', async () => {
    const result = await upsertTrackedIdentity({
      projectId: secondProjectId,
      externalId: 'shared-user',
      observedAt: new Date('2026-03-10T10:00:00.000Z'),
    });

    const rows = await prisma.client.trackedUser.findMany({
      where: { externalId: 'shared-user', projectId: { in: [firstProjectId, secondProjectId] } },
      select: { id: true, projectId: true },
      orderBy: { projectId: 'asc' },
    });

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(row => row.projectId))).toEqual(
      new Set([firstProjectId, secondProjectId]),
    );
    expect(result?.trackedUserId).not.toBe(rows.find(row => row.projectId === firstProjectId)?.id);
  });

  test('does not let a late observation roll traits or current membership back', async () => {
    const externalId = 'membership-user';

    await upsertTrackedIdentity({
      projectId: firstProjectId,
      externalId,
      traits: { plan: 'starter' },
      account: { id: 'old-account' },
      observedAt: new Date('2026-03-05T10:00:00.000Z'),
    });
    await upsertTrackedIdentity({
      projectId: firstProjectId,
      externalId,
      traits: { plan: 'enterprise' },
      account: { id: 'current-account' },
      observedAt: new Date('2026-03-08T10:00:00.000Z'),
    });
    await upsertTrackedIdentity({
      projectId: firstProjectId,
      externalId,
      traits: { plan: 'free' },
      account: { id: 'old-account' },
      observedAt: new Date('2026-03-01T10:00:00.000Z'),
    });

    const user = await prisma.client.trackedUser.findUniqueOrThrow({
      where: { projectId_externalId: { projectId: firstProjectId, externalId } },
      include: { membership: { include: { account: true } } },
    });

    expect(user.traits).toMatchObject({ plan: 'enterprise' });
    expect(user.firstSeenAt).toEqual(new Date('2026-03-01T10:00:00.000Z'));
    expect(user.lastSeenAt).toEqual(new Date('2026-03-08T10:00:00.000Z'));
    expect(user.membership?.account.externalId).toBe('current-account');
    expect(user.membership?.observedAt).toEqual(new Date('2026-03-08T10:00:00.000Z'));
  });

  test('reset clears identities plus replay/heatmap evidence and delete removes the Project', async () => {
    const projectId = randomUUID();
    const sessionId = randomUUID();
    const visitId = randomUUID();

    await prisma.client.website.create({
      data: { id: projectId, name: 'Deletion project', domain: 'delete.identity.test' },
    });
    await prisma.client.session.create({
      data: { id: sessionId, websiteId: projectId, createdAt: new Date('2026-03-01T00:00:00Z') },
    });
    await prisma.client.sessionReplay.create({
      data: {
        id: randomUUID(),
        websiteId: projectId,
        sessionId,
        visitId,
        chunkIndex: 0,
        events: Buffer.from('[]'),
        eventCount: 0,
        startedAt: new Date('2026-03-01T00:00:00Z'),
        endedAt: new Date('2026-03-01T00:00:01Z'),
      },
    });
    await prisma.client.heatmapEvent.create({
      data: {
        id: randomUUID(),
        websiteId: projectId,
        sessionId,
        visitId,
        urlPath: '/app',
        eventType: 1,
        x: 10,
        y: 20,
        createdAt: new Date('2026-03-01T00:00:00Z'),
      },
    });
    await upsertTrackedIdentity({
      projectId,
      externalId: 'delete-user',
      account: { id: 'delete-account' },
      observedAt: new Date('2026-03-01T00:00:00Z'),
    });

    await resetWebsite(projectId);

    const resetCounts = await Promise.all([
      prisma.client.accountMembership.count({ where: { projectId } }),
      prisma.client.trackedUser.count({ where: { projectId } }),
      prisma.client.trackedAccount.count({ where: { projectId } }),
      prisma.client.sessionReplay.count({ where: { websiteId: projectId } }),
      prisma.client.heatmapEvent.count({ where: { websiteId: projectId } }),
      prisma.client.session.count({ where: { websiteId: projectId } }),
    ]);
    expect(resetCounts).toEqual([0, 0, 0, 0, 0, 0]);

    await upsertTrackedIdentity({
      projectId,
      externalId: 'delete-user',
      observedAt: new Date('2026-03-02T00:00:00Z'),
    });
    await deleteWebsite(projectId);

    await expect(prisma.client.website.findUnique({ where: { id: projectId } })).resolves.toBeNull();
    await expect(prisma.client.trackedUser.count({ where: { projectId } })).resolves.toBe(0);
  });
});
