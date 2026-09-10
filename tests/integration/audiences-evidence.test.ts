import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { deleteWebsite } from '@/queries/prisma/website';
import { previewOperationalSegment } from '@/server/audiences/segment-service';
import { getSessionEvidence } from '@/server/evidence/evidence-service';
import {
  getTrackedAccountProfile,
  getTrackedUserProfile,
} from '@/server/identities/profile-service';
import { listTrackedUsers } from '@/server/identities/read-service';
import { upsertTrackedIdentity } from '@/server/identities/upsert';

const projectId = randomUUID();
const otherProjectId = randomUUID();
const observedAt = new Date(Date.now() - 86_400_000);
const eventAt = new Date(observedAt.getTime() + 300_000);
const sessionIds = [randomUUID(), randomUUID()];

const access = {
  actorUserId: randomUUID(),
  projectId,
  tenantId: projectId,
  permissionScope: 'identity-sensitive' as const,
  canCreate: true,
  canManageAll: true,
};

describe('M11-M12 operational Audiences and evidence PostgreSQL flow', () => {
  beforeAll(async () => {
    await prisma.client.website.createMany({
      data: [
        {
          id: projectId,
          name: 'Audience evidence project',
          domain: `${projectId}.audience.test`,
          replayConfig: { replayEnabled: false, maskLevel: 'strict' },
        },
        {
          id: otherProjectId,
          name: 'Other tenant project',
          domain: `${otherProjectId}.audience.test`,
        },
      ],
    });
    for (const [externalId, accountId, plan] of [
      ['alice', 'acme', 'enterprise'],
      ['bob', 'acme', 'starter'],
      ['carol', 'beta', 'enterprise'],
    ]) {
      await upsertTrackedIdentity({
        projectId,
        externalId,
        traits: { plan, email: `${externalId}@example.test` },
        account: { id: accountId, name: accountId === 'acme' ? 'Acme' : 'Beta' },
        observedAt,
      });
    }
    await upsertTrackedIdentity({ projectId: otherProjectId, externalId: 'alice', observedAt });
    await prisma.client.session.createMany({
      data: [
        {
          id: sessionIds[0],
          websiteId: projectId,
          distinctId: 'alice',
          browser: 'Chrome',
          device: 'desktop',
          createdAt: observedAt,
        },
        {
          id: sessionIds[1],
          websiteId: projectId,
          distinctId: 'bob',
          browser: 'Safari',
          device: 'mobile',
          createdAt: observedAt,
        },
      ],
    });
    await prisma.client.websiteEvent.createMany({
      data: [
        {
          id: randomUUID(),
          websiteId: projectId,
          sessionId: sessionIds[0],
          visitId: randomUUID(),
          eventType: 2,
          eventName: 'core_feature_used',
          urlPath: '/workspace',
          pageTitle: 'Alice workspace',
          lcp: 1200,
          inp: 80,
          cls: 0.05,
          createdAt: eventAt,
        },
        {
          id: randomUUID(),
          websiteId: projectId,
          sessionId: sessionIds[1],
          visitId: randomUUID(),
          eventType: 2,
          eventName: 'signup',
          urlPath: '/',
          createdAt: eventAt,
        },
      ],
    });
  });

  afterAll(async () => {
    await deleteWebsite(projectId);
    await deleteWebsite(otherProjectId);
    await prisma.client.$disconnect();
  });

  test('keeps duplicate-timestamp cursor pages stable and tenant-scoped', async () => {
    const first = await listTrackedUsers({
      projectId,
      scope: 'identity-sensitive',
      limit: 2,
      sort: 'lastSeenAt',
      direction: 'desc',
    });
    expect(first.data).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = await listTrackedUsers({
      projectId,
      scope: 'identity-sensitive',
      limit: 2,
      sort: 'lastSeenAt',
      direction: 'desc',
      cursor: first.nextCursor as string,
    });
    const ids = [...first.data, ...second.data].map(item => item.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids)).toHaveLength(3);
    expect([...first.data, ...second.data].map(item => item.projectId)).toEqual([
      projectId,
      projectId,
      projectId,
    ]);
  });

  test('keeps profiles definition-backed, exact and masked by role', async () => {
    const alice = await prisma.client.trackedUser.findUniqueOrThrow({
      where: { projectId_externalId: { projectId, externalId: 'alice' } },
    });
    const standard = await getTrackedUserProfile({
      projectId,
      trackedUserId: alice.id,
      scope: 'identity-standard',
    });
    expect(standard).not.toHaveProperty('externalId');
    expect(standard).not.toHaveProperty('sensitiveTraits');
    expect(standard.adoption).toMatchObject({ sessions: 1, events: 1 });
    expect(standard.lifecycle.definition).toMatchObject({ exactness: 'exact' });

    const acme = await prisma.client.trackedAccount.findUniqueOrThrow({
      where: { projectId_externalId: { projectId, externalId: 'acme' } },
    });
    const account = await getTrackedAccountProfile({
      projectId,
      trackedAccountId: acme.id,
      scope: 'identity-sensitive',
    });
    expect(account.members).toHaveLength(2);
    expect(account.adoption).toMatchObject({ sessions: 2, events: 2 });
  });

  test('matches operational behavior preview to session evidence without exposing text', async () => {
    const segment = await previewOperationalSegment(access, {
      version: 1,
      entity: 'user',
      match: 'all',
      conditions: [
        { kind: 'trait', field: 'plan', operator: 'equals', value: 'enterprise' },
        { kind: 'behavior', eventName: 'core_feature_used', withinDays: 90, minCount: 1 },
      ],
    });
    expect(segment).toMatchObject({ exactness: 'exact', count: 1 });

    const evidence = await getSessionEvidence({
      projectId,
      scope: 'identity-standard',
      query: { sessionId: sessionIds[0], limit: 50, urlPath: '/workspace' },
    });
    expect(evidence.session.id).toBe(sessionIds[0]);
    expect(evidence.timeline.data).toMatchObject([
      { label: 'core_feature_used', pageTitle: null, properties: [] },
    ]);
    expect(evidence.replay.state).toBe('permission-denied');
  });
});
