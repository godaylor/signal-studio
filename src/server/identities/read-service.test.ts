import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  decodeIdentityCursor,
  InvalidIdentityCursorError,
  listTrackedAccounts,
  listTrackedUsers,
} from './read-service';

const { usersFindManyMock, accountsFindManyMock } = vi.hoisted(() => ({
  usersFindManyMock: vi.fn(),
  accountsFindManyMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      trackedUser: { findMany: usersFindManyMock },
      trackedAccount: { findMany: accountsFindManyMock },
    },
  },
}));

const projectId = '11111111-1111-4111-8111-111111111111';
const observedAt = new Date('2026-03-12T10:00:00.000Z');

describe('tracked identity read service', () => {
  beforeEach(() => {
    usersFindManyMock.mockReset();
    accountsFindManyMock.mockReset();
    usersFindManyMock.mockResolvedValue([]);
    accountsFindManyMock.mockResolvedValue([]);
  });

  test('never selects sensitive user/account fields for standard scope', async () => {
    await listTrackedUsers({ projectId, scope: 'identity-standard' });

    const select = usersFindManyMock.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('externalId');
    expect(select).not.toHaveProperty('displayName');
    expect(select).not.toHaveProperty('sensitiveTraits');
    expect(select.membership.select.account.select).not.toHaveProperty('externalId');
    expect(select.membership.select.account.select).not.toHaveProperty('name');
    expect(select.membership.select.account.select).not.toHaveProperty('sensitiveTraits');
  });

  test('selects separately stored sensitive fields only for sensitive scope', async () => {
    await listTrackedAccounts({ projectId, scope: 'identity-sensitive' });

    const select = accountsFindManyMock.mock.calls[0][0].select;
    expect(select).toMatchObject({ externalId: true, name: true, sensitiveTraits: true });
  });

  test('uses a stable activity-plus-id cursor without an expensive total count', async () => {
    usersFindManyMock.mockResolvedValue([
      { id: 'user-3', lastSeenAt: observedAt },
      { id: 'user-2', lastSeenAt: observedAt },
    ]);

    const first = await listTrackedUsers({ projectId, scope: 'identity-standard', limit: 1 });
    expect(first.data).toHaveLength(1);
    expect(first.nextCursor).toEqual(expect.any(String));

    const decoded = decodeIdentityCursor(first.nextCursor);
    expect(decoded).toEqual({
      version: 1,
      sort: 'lastSeenAt',
      direction: 'desc',
      value: observedAt.toISOString(),
      id: 'user-3',
    });

    usersFindManyMock.mockResolvedValue([]);
    await listTrackedUsers({
      projectId,
      scope: 'identity-standard',
      cursor: first.nextCursor,
      limit: 1,
    });

    expect(usersFindManyMock.mock.calls[1][0].where).toEqual({
      projectId,
      AND: [
        {
          OR: [
            { lastSeenAt: { lt: observedAt } },
            { lastSeenAt: observedAt, id: { lt: 'user-3' } },
          ],
        },
      ],
    });
  });

  test('binds cursors to sort and direction and applies scoped search', async () => {
    usersFindManyMock.mockResolvedValue([
      { id: 'user-3', lifecycleStage: 'activated', lastSeenAt: observedAt },
      { id: 'user-2', lifecycleStage: 'activated', lastSeenAt: observedAt },
    ]);
    const first = await listTrackedUsers({
      projectId,
      scope: 'identity-sensitive',
      sort: 'lifecycleStage',
      direction: 'asc',
      search: 'alice',
      limit: 1,
    });
    expect(() => decodeIdentityCursor(first.nextCursor ?? '', 'lastSeenAt', 'desc')).toThrow(
      InvalidIdentityCursorError,
    );
    expect(usersFindManyMock.mock.calls[0][0]).toMatchObject({
      orderBy: [{ lifecycleStage: 'asc' }, { id: 'asc' }],
      where: {
        AND: [
          {
            OR: [
              { externalId: { contains: 'alice', mode: 'insensitive' } },
              { displayName: { contains: 'alice', mode: 'insensitive' } },
            ],
          },
        ],
      },
    });
  });

  test('rejects malformed cursors', () => {
    expect(() => decodeIdentityCursor('not-base64-json')).toThrow(InvalidIdentityCursorError);
  });
});
