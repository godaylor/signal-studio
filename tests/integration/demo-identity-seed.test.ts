import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { M4_DEMO_IDS, seedM4Demo } from '../../scripts/seed-m4-demo-data.js';

const projectId = randomUUID();
const seedIds = Object.fromEntries(
  Object.keys(M4_DEMO_IDS).map(key => [key, randomUUID()]),
) as Record<keyof typeof M4_DEMO_IDS, string>;

async function semanticSnapshot() {
  const [accounts, users, memberships, sessions, events, revenue] = await Promise.all([
    prisma.client.trackedAccount.findMany({
      where: { projectId },
      select: {
        id: true,
        externalId: true,
        lifecycleStage: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
      orderBy: { id: 'asc' },
    }),
    prisma.client.trackedUser.findMany({
      where: { projectId },
      select: {
        id: true,
        externalId: true,
        lifecycleStage: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
      orderBy: { id: 'asc' },
    }),
    prisma.client.accountMembership.findMany({
      where: { projectId },
      select: { trackedUserId: true, trackedAccountId: true, observedAt: true },
      orderBy: { trackedUserId: 'asc' },
    }),
    prisma.client.session.count({ where: { websiteId: projectId } }),
    prisma.client.websiteEvent.count({ where: { websiteId: projectId } }),
    prisma.client.revenue.count({ where: { websiteId: projectId } }),
  ]);

  return JSON.parse(JSON.stringify({ accounts, users, memberships, sessions, events, revenue }));
}

describe('deterministic M4 PLG demo seed', () => {
  beforeAll(async () => {
    await prisma.client.website.create({
      data: { id: projectId, name: 'M4 seed integration', domain: 'm4-seed.test' },
    });
  });

  afterAll(async () => {
    await prisma.client.accountMembership.deleteMany({ where: { projectId } });
    await prisma.client.trackedUser.deleteMany({ where: { projectId } });
    await prisma.client.trackedAccount.deleteMany({ where: { projectId } });
    await prisma.client.revenue.deleteMany({ where: { websiteId: projectId } });
    await prisma.client.sessionData.deleteMany({ where: { websiteId: projectId } });
    await prisma.client.websiteEvent.deleteMany({ where: { websiteId: projectId } });
    await prisma.client.session.deleteMany({ where: { websiteId: projectId } });
    await prisma.client.website.deleteMany({ where: { id: projectId } });
    await prisma.client.$disconnect();
  });

  test('two runs produce the same sorted semantic snapshot', async () => {
    await seedM4Demo(prisma.client, { projectId, ids: seedIds });
    const first = await semanticSnapshot();

    await seedM4Demo(prisma.client, { projectId, ids: seedIds });
    const second = await semanticSnapshot();

    expect(second).toEqual(first);
    expect(second).toMatchObject({ sessions: 4, events: 8, revenue: 1 });
    expect(second.accounts).toHaveLength(2);
    expect(second.users).toHaveLength(3);
    expect(second.memberships).toContainEqual({
      trackedUserId: seedIds.cara,
      trackedAccountId: seedIds.enterpriseAccount,
      observedAt: '2026-03-04T08:00:00.000Z',
    });
  });
});
