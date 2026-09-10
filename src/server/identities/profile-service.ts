import prisma from '@/lib/prisma';
import { canViewSensitiveTraits, type ProjectDataScope } from '@/server/permissions/project-data';
import { ACTIVATION_DEFINITION, ADOPTION_DEFINITION } from './definitions';

export class TrackedIdentityNotFoundError extends Error {}

const sessionSelect = {
  id: true,
  browser: true,
  os: true,
  device: true,
  country: true,
  createdAt: true,
  _count: { select: { websiteEvents: true } },
} as const;

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function sessionDto(session: any) {
  return {
    id: session.id,
    browser: session.browser,
    os: session.os,
    device: session.device,
    country: session.country,
    createdAt: iso(session.createdAt),
    eventCount: session._count.websiteEvents,
  };
}

export async function getTrackedUserProfile({
  projectId,
  trackedUserId,
  scope,
}: {
  projectId: string;
  trackedUserId: string;
  scope: ProjectDataScope;
}) {
  const sensitive = canViewSensitiveTraits(scope);
  const user = await prisma.client.trackedUser.findFirst({
    where: { id: trackedUserId, projectId },
    select: {
      id: true,
      externalId: true,
      displayName: true,
      traits: true,
      sensitiveTraits: true,
      lifecycleStage: true,
      definitionVersion: true,
      activatedAt: true,
      firstSeenAt: true,
      lastSeenAt: true,
      membership: {
        select: {
          observedAt: true,
          account: {
            select: { id: true, externalId: true, name: true, lifecycleStage: true },
          },
        },
      },
    },
  });
  if (!user) throw new TrackedIdentityNotFoundError('Tracked user was not found.');

  const [sessions, sessionCount, eventCount] = await Promise.all([
    prisma.client.session.findMany({
      where: { websiteId: projectId, distinctId: user.externalId },
      select: sessionSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
    }),
    prisma.client.session.count({ where: { websiteId: projectId, distinctId: user.externalId } }),
    prisma.client.websiteEvent.count({
      where: { websiteId: projectId, session: { distinctId: user.externalId } },
    }),
  ]);

  return {
    id: user.id,
    label: sensitive
      ? (user.displayName ?? user.externalId)
      : `Tracked user ${user.id.slice(0, 8)}`,
    ...(sensitive
      ? {
          externalId: user.externalId,
          displayName: user.displayName,
          sensitiveTraits: user.sensitiveTraits,
        }
      : {}),
    traits: user.traits,
    lifecycle: {
      stage: user.lifecycleStage,
      activatedAt: iso(user.activatedAt),
      firstSeenAt: iso(user.firstSeenAt),
      lastSeenAt: iso(user.lastSeenAt),
      definition: ACTIVATION_DEFINITION,
      storedDefinitionVersion: user.definitionVersion,
    },
    adoption: { sessions: sessionCount, events: eventCount, definition: ADOPTION_DEFINITION },
    account: user.membership
      ? {
          id: user.membership.account.id,
          label: sensitive
            ? (user.membership.account.name ?? user.membership.account.externalId)
            : `Account ${user.membership.account.id.slice(0, 8)}`,
          lifecycleStage: user.membership.account.lifecycleStage,
          observedAt: iso(user.membership.observedAt),
        }
      : null,
    sessions: sessions.map(sessionDto),
    permissionScope: scope,
  };
}

export async function getTrackedAccountProfile({
  projectId,
  trackedAccountId,
  scope,
}: {
  projectId: string;
  trackedAccountId: string;
  scope: ProjectDataScope;
}) {
  const sensitive = canViewSensitiveTraits(scope);
  const account = await prisma.client.trackedAccount.findFirst({
    where: { id: trackedAccountId, projectId },
    select: {
      id: true,
      externalId: true,
      name: true,
      traits: true,
      sensitiveTraits: true,
      lifecycleStage: true,
      definitionVersion: true,
      activatedAt: true,
      firstSeenAt: true,
      lastSeenAt: true,
      memberships: {
        select: {
          observedAt: true,
          user: {
            select: { id: true, externalId: true, displayName: true, lifecycleStage: true },
          },
        },
        orderBy: [{ user: { lastSeenAt: 'desc' } }, { trackedUserId: 'desc' }],
        take: 50,
      },
    },
  });
  if (!account) throw new TrackedIdentityNotFoundError('Tracked account was not found.');
  const externalIds = account.memberships.map(item => item.user.externalId);
  const [sessions, sessionCount, eventCount] = externalIds.length
    ? await Promise.all([
        prisma.client.session.findMany({
          where: { websiteId: projectId, distinctId: { in: externalIds } },
          select: { ...sessionSelect, distinctId: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 50,
        }),
        prisma.client.session.count({
          where: { websiteId: projectId, distinctId: { in: externalIds } },
        }),
        prisma.client.websiteEvent.count({
          where: { websiteId: projectId, session: { distinctId: { in: externalIds } } },
        }),
      ])
    : [[], 0, 0];
  const sessionsByUser = new Map<string, any[]>();
  for (const session of sessions) {
    if (!session.distinctId) continue;
    const group = sessionsByUser.get(session.distinctId) ?? [];
    group.push(sessionDto(session));
    sessionsByUser.set(session.distinctId, group);
  }

  return {
    id: account.id,
    label: sensitive ? (account.name ?? account.externalId) : `Account ${account.id.slice(0, 8)}`,
    ...(sensitive
      ? {
          externalId: account.externalId,
          name: account.name,
          sensitiveTraits: account.sensitiveTraits,
        }
      : {}),
    traits: account.traits,
    lifecycle: {
      stage: account.lifecycleStage,
      activatedAt: iso(account.activatedAt),
      firstSeenAt: iso(account.firstSeenAt),
      lastSeenAt: iso(account.lastSeenAt),
      definition: { ...ACTIVATION_DEFINITION, unit: 'tracked-account' },
      storedDefinitionVersion: account.definitionVersion,
    },
    adoption: {
      sessions: sessionCount,
      events: eventCount,
      definition: { ...ADOPTION_DEFINITION, unit: 'tracked-account' },
    },
    members: account.memberships.map(membership => ({
      id: membership.user.id,
      label: sensitive
        ? (membership.user.displayName ?? membership.user.externalId)
        : `Tracked user ${membership.user.id.slice(0, 8)}`,
      lifecycleStage: membership.user.lifecycleStage,
      observedAt: iso(membership.observedAt),
      sessions: sessionsByUser.get(membership.user.externalId) ?? [],
    })),
    permissionScope: scope,
  };
}
