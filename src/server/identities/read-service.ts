import prisma from '@/lib/prisma';
import type { IdentityListQuery } from '@/server/audiences/contracts';
import { canViewSensitiveTraits, type ProjectDataScope } from '@/server/permissions/project-data';

export const DEFAULT_IDENTITY_PAGE_SIZE = 50;
export const MAX_IDENTITY_PAGE_SIZE = 100;

type IdentityReadClient = Pick<typeof prisma.client, 'trackedUser' | 'trackedAccount'>;

type IdentitySort = IdentityListQuery['sort'];
type IdentityDirection = IdentityListQuery['direction'];
type IdentityCursor = {
  version: 1;
  sort: IdentitySort;
  direction: IdentityDirection;
  value: string;
  id: string;
};

export class InvalidIdentityCursorError extends Error {
  constructor() {
    super('The identity cursor is invalid or expired.');
    this.name = 'InvalidIdentityCursorError';
  }
}

function encodeCursor(value: IdentityCursor) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeIdentityCursor(
  value: string | undefined,
  sort: IdentitySort = 'lastSeenAt',
  direction: IdentityDirection = 'desc',
): IdentityCursor | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as IdentityCursor;

    if (
      typeof parsed.id !== 'string' ||
      parsed.version !== 1 ||
      parsed.sort !== sort ||
      parsed.direction !== direction ||
      typeof parsed.value !== 'string' ||
      ((sort === 'lastSeenAt' || sort === 'firstSeenAt') &&
        Number.isNaN(new Date(parsed.value).getTime()))
    ) {
      throw new InvalidIdentityCursorError();
    }

    return parsed;
  } catch (error) {
    if (error instanceof InvalidIdentityCursorError) {
      throw error;
    }

    throw new InvalidIdentityCursorError();
  }
}

function getCursorClause(cursor: IdentityCursor | null) {
  if (!cursor) return undefined;
  const comparison = cursor.direction === 'asc' ? 'gt' : 'lt';
  const value =
    cursor.sort === 'lastSeenAt' || cursor.sort === 'firstSeenAt'
      ? new Date(cursor.value)
      : cursor.value;
  return {
    OR: [
      { [cursor.sort]: { [comparison]: value } },
      { [cursor.sort]: value, id: { [comparison]: cursor.id } },
    ],
  };
}

function getIdentityWhere({
  projectId,
  scope,
  search,
  lifecycle,
  cursor,
  labelField,
}: {
  projectId: string;
  scope: ProjectDataScope;
  search?: string;
  lifecycle?: string;
  cursor: IdentityCursor | null;
  labelField: 'displayName' | 'name';
}) {
  const cursorClause = getCursorClause(cursor);
  const sensitive = canViewSensitiveTraits(scope);
  return {
    projectId,
    ...(lifecycle ? { lifecycleStage: lifecycle } : {}),
    AND: [
      ...(cursorClause ? [cursorClause] : []),
      ...(search
        ? [
            sensitive
              ? {
                  OR: [
                    { externalId: { contains: search, mode: 'insensitive' as const } },
                    { [labelField]: { contains: search, mode: 'insensitive' as const } },
                  ],
                }
              : { lifecycleStage: { contains: search, mode: 'insensitive' as const } },
          ]
        : []),
    ],
  };
}

function cursorValue(item: any, sort: IdentitySort) {
  const value = item[sort];
  return value instanceof Date ? value.toISOString() : String(value);
}

function toPage(items: any[], limit: number, sort: IdentitySort, direction: IdentityDirection) {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const last = data[data.length - 1];

  return {
    data,
    nextCursor:
      hasMore && last
        ? encodeCursor({ version: 1, sort, direction, value: cursorValue(last, sort), id: last.id })
        : null,
  };
}

export async function listTrackedUsers({
  projectId,
  scope,
  cursor,
  limit = DEFAULT_IDENTITY_PAGE_SIZE,
  search,
  sort = 'lastSeenAt',
  direction = 'desc',
  lifecycle,
}: {
  projectId: string;
  scope: ProjectDataScope;
  cursor?: string;
  limit?: number;
  search?: string;
  sort?: IdentitySort;
  direction?: IdentityDirection;
  lifecycle?: string;
}, client: IdentityReadClient = prisma.client) {
  const boundedLimit = Math.min(Math.max(limit, 1), MAX_IDENTITY_PAGE_SIZE);
  const where = getIdentityWhere({
    projectId,
    scope,
    search,
    lifecycle,
    cursor: decodeIdentityCursor(cursor, sort, direction),
    labelField: 'displayName',
  });
  const sensitive = canViewSensitiveTraits(scope);
  const commonSelect = {
    id: true,
    projectId: true,
    traits: true,
    lifecycleStage: true,
    definitionVersion: true,
    activatedAt: true,
    firstSeenAt: true,
    lastSeenAt: true,
    membership: {
      select: {
        observedAt: true,
        account: {
          select: {
            id: true,
            traits: true,
            lifecycleStage: true,
            definitionVersion: true,
            firstSeenAt: true,
            lastSeenAt: true,
            ...(sensitive && {
              externalId: true,
              name: true,
              sensitiveTraits: true,
            }),
          },
        },
      },
    },
    ...(sensitive && {
      externalId: true,
      displayName: true,
      sensitiveTraits: true,
    }),
  } as const;

  const items = await client.trackedUser.findMany({
    where,
    select: commonSelect,
    orderBy: [{ [sort]: direction }, { id: direction }],
    take: boundedLimit + 1,
  });

  return toPage(items, boundedLimit, sort, direction);
}

export async function listTrackedAccounts({
  projectId,
  scope,
  cursor,
  limit = DEFAULT_IDENTITY_PAGE_SIZE,
  search,
  sort = 'lastSeenAt',
  direction = 'desc',
  lifecycle,
}: {
  projectId: string;
  scope: ProjectDataScope;
  cursor?: string;
  limit?: number;
  search?: string;
  sort?: IdentitySort;
  direction?: IdentityDirection;
  lifecycle?: string;
}, client: IdentityReadClient = prisma.client) {
  const boundedLimit = Math.min(Math.max(limit, 1), MAX_IDENTITY_PAGE_SIZE);
  const where = getIdentityWhere({
    projectId,
    scope,
    search,
    lifecycle,
    cursor: decodeIdentityCursor(cursor, sort, direction),
    labelField: 'name',
  });
  const sensitive = canViewSensitiveTraits(scope);

  const items = await client.trackedAccount.findMany({
    where,
    select: {
      id: true,
      projectId: true,
      traits: true,
      lifecycleStage: true,
      definitionVersion: true,
      activatedAt: true,
      firstSeenAt: true,
      lastSeenAt: true,
      _count: { select: { memberships: true } },
      ...(sensitive && {
        externalId: true,
        name: true,
        sensitiveTraits: true,
      }),
    },
    orderBy: [{ [sort]: direction }, { id: direction }],
    take: boundedLimit + 1,
  });

  return toPage(items, boundedLimit, sort, direction);
}
