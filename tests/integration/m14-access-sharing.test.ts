import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import type { Auth } from '@/lib/types';
import { listTrackedUsers } from '@/server/identities/read-service';
import { resolveProjectAccess } from '@/server/permissions/capabilities';
import { getProjectDataScope } from '@/server/permissions/project-data';
import { SAFE_SHARE_SCOPE } from '@/server/shares/contracts';
import {
  createStudioShare,
  revokeStudioShare,
  StudioShareForbiddenError,
  StudioShareNotFoundError,
} from '@/server/shares/share-service';

const ids = {
  owner: randomUUID(),
  analyst: randomUUID(),
  outsider: randomUUID(),
  workspace: randomUUID(),
  otherWorkspace: randomUUID(),
  project: randomUUID(),
  otherProject: randomUUID(),
  ownerMembership: randomUUID(),
  analystMembership: randomUUID(),
  insight: randomUUID(),
  otherInsight: randomUUID(),
  trackedUser: randomUUID(),
};

const ownerAuth = {
  user: { id: ids.owner, username: `m14-owner-${ids.owner}`, role: 'user', isAdmin: false },
} as Auth;
const analystAuth = {
  user: { id: ids.analyst, username: `m14-analyst-${ids.analyst}`, role: 'user', isAdmin: false },
} as Auth;

function query(projectId: string) {
  return {
    version: 1,
    projectId,
    mode: 'trend',
    range: {
      startAt: '2026-01-01T00:00:00.000Z',
      endAt: '2026-01-08T00:00:00.000Z',
      timezone: 'UTC',
      unit: 'day',
    },
    measure: { source: 'event', key: 'pageview', aggregation: 'count' },
    filters: [],
    match: 'all',
    comparison: 'none',
    visualization: 'line',
  };
}

describe('M14 PostgreSQL access and safe sharing', () => {
  beforeAll(async () => {
    await prisma.client.user.createMany({
      data: [
        {
          id: ids.owner,
          username: ownerAuth.user.username,
          password: 'x'.repeat(60),
          role: 'user',
        },
        {
          id: ids.analyst,
          username: analystAuth.user.username,
          password: 'x'.repeat(60),
          role: 'user',
        },
        {
          id: ids.outsider,
          username: `m14-outsider-${ids.outsider}`,
          password: 'x'.repeat(60),
          role: 'user',
        },
      ],
    });
    await prisma.client.team.createMany({
      data: [
        { id: ids.workspace, name: `M14 ${ids.workspace.slice(0, 8)}` },
        { id: ids.otherWorkspace, name: `M14 other ${ids.otherWorkspace.slice(0, 8)}` },
      ],
    });
    await prisma.client.website.createMany({
      data: [
        { id: ids.project, name: 'M14 project', domain: 'm14.example', teamId: ids.workspace },
        {
          id: ids.otherProject,
          name: 'M14 other project',
          domain: 'other-m14.example',
          teamId: ids.otherWorkspace,
        },
      ],
    });
    await prisma.client.teamUser.createMany({
      data: [
        {
          id: ids.ownerMembership,
          teamId: ids.workspace,
          userId: ids.owner,
          role: 'team-owner',
          studioRole: 'owner',
          capabilityOverrides: {},
        },
        {
          id: ids.analystMembership,
          teamId: ids.workspace,
          userId: ids.analyst,
          role: 'team-member',
          studioRole: 'analyst',
          capabilityOverrides: {},
        },
      ],
    });
    await prisma.client.insight.createMany({
      data: [
        {
          id: ids.insight,
          projectId: ids.project,
          ownerId: ids.owner,
          title: 'M14 safe insight',
          queryVersion: 1,
          query: query(ids.project),
        },
        {
          id: ids.otherInsight,
          projectId: ids.otherProject,
          ownerId: ids.outsider,
          title: 'M14 foreign insight',
          queryVersion: 1,
          query: query(ids.otherProject),
        },
      ],
    });
    await prisma.client.trackedUser.create({
      data: {
        id: ids.trackedUser,
        projectId: ids.project,
        externalId: `m14-sensitive-${ids.trackedUser}`,
        displayName: 'M14 Sensitive Person',
        traits: { plan: 'pro' },
        sensitiveTraits: { email: 'm14-sensitive@example.test' },
        firstSeenAt: new Date('2026-01-02T00:00:00.000Z'),
        lastSeenAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    await prisma.client.share.deleteMany({
      where: { projectId: { in: [ids.project, ids.otherProject] } },
    });
    await prisma.client.insight.deleteMany({
      where: { id: { in: [ids.insight, ids.otherInsight] } },
    });
    await prisma.client.trackedUser.deleteMany({ where: { id: ids.trackedUser } });
    await prisma.client.teamUser.deleteMany({
      where: { teamId: { in: [ids.workspace, ids.otherWorkspace] } },
    });
    await prisma.client.website.deleteMany({
      where: { id: { in: [ids.project, ids.otherProject] } },
    });
    await prisma.client.team.deleteMany({
      where: { id: { in: [ids.workspace, ids.otherWorkspace] } },
    });
    await prisma.client.user.deleteMany({
      where: { id: { in: [ids.owner, ids.analyst, ids.outsider] } },
    });
    await prisma.client.$disconnect();
  });

  test('resolves Analyst from studioRole, keeps legacy team-member, and denies high-risk defaults', async () => {
    const access = await resolveProjectAccess(analystAuth, ids.project);
    expect(access).toMatchObject({ studioRole: 'analyst', legacyRole: 'team-member' });
    expect(access?.capabilities).toMatchObject({
      viewAggregate: true,
      viewIdentity: true,
      manageSources: false,
      manageMembers: false,
      viewSensitiveTraits: false,
      viewReplay: false,
      exportData: false,
      createPublicShare: false,
    });
  });

  test('does not leak project access across workspaces', async () => {
    await expect(resolveProjectAccess(analystAuth, ids.otherProject)).resolves.toBeNull();
  });

  test('masks sensitive identity fields for Analyst until an explicit override is present', async () => {
    const standardScope = await getProjectDataScope(analystAuth, ids.project);
    expect(standardScope).toBe('identity-standard');

    const standard = await listTrackedUsers({
      projectId: ids.project,
      scope: standardScope,
      limit: 10,
    });
    const masked = standard.data.find(item => item.id === ids.trackedUser);
    expect(masked).toMatchObject({ id: ids.trackedUser, traits: { plan: 'pro' } });
    expect(masked).not.toHaveProperty('externalId');
    expect(masked).not.toHaveProperty('displayName');
    expect(masked).not.toHaveProperty('sensitiveTraits');

    await prisma.client.teamUser.update({
      where: { id: ids.analystMembership },
      data: { capabilityOverrides: { viewSensitiveTraits: true } },
    });
    const sensitiveScope = await getProjectDataScope(analystAuth, ids.project);
    expect(sensitiveScope).toBe('identity-sensitive');
    const sensitive = await listTrackedUsers({
      projectId: ids.project,
      scope: sensitiveScope,
      limit: 10,
    });
    expect(sensitive.data.find(item => item.id === ids.trackedUser)).toMatchObject({
      externalId: `m14-sensitive-${ids.trackedUser}`,
      displayName: 'M14 Sensitive Person',
      sensitiveTraits: { email: 'm14-sensitive@example.test' },
    });

    await prisma.client.teamUser.update({
      where: { id: ids.analystMembership },
      data: { capabilityOverrides: {} },
    });
  });

  test('denies public sharing by default and never accepts a foreign project resource', async () => {
    const input = {
      auth: analystAuth,
      projectId: ids.project,
      resourceType: 'insight' as const,
      name: 'M14 public share',
      visibility: 'public' as const,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      scope: SAFE_SHARE_SCOPE,
    };
    await expect(createStudioShare({ ...input, resourceId: ids.insight })).rejects.toBeInstanceOf(
      StudioShareForbiddenError,
    );

    await prisma.client.teamUser.update({
      where: { id: ids.analystMembership },
      data: { capabilityOverrides: { createPublicShare: true } },
    });
    await expect(
      createStudioShare({ ...input, resourceId: ids.otherInsight }),
    ).rejects.toBeInstanceOf(StudioShareNotFoundError);
  });

  test('applies the explicit override, persists aggregate-only scope, and revokes immediately', async () => {
    const created = await createStudioShare({
      auth: analystAuth,
      projectId: ids.project,
      resourceType: 'insight',
      resourceId: ids.insight,
      name: 'M14 revocable share',
      visibility: 'public',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      scope: SAFE_SHARE_SCOPE,
    });
    expect(created.scope).toEqual(SAFE_SHARE_SCOPE);

    const startedAt = performance.now();
    const revoked = await revokeStudioShare(analystAuth, ids.project, created.id);
    const revocationLatencyMs = performance.now() - startedAt;
    expect(revoked.revokedAt).not.toBeNull();
    expect(revocationLatencyMs).toBeLessThan(1_500);

    const record = await prisma.client.share.findUniqueOrThrow({ where: { id: created.id } });
    expect(record.tokenVersion).toBe(2);
    expect(record.revokedAt).not.toBeNull();
  });
});
