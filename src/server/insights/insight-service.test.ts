import { beforeEach, describe, expect, test, vi } from 'vitest';
import { deriveInsightCapabilities } from '@/server/permissions/insights';
import {
  decodeInsightCursor,
  duplicateInsight,
  encodeInsightCursor,
  InvalidInsightCursorError,
  listInsights,
  toInsightDto,
} from './insight-service';

const prismaMock = vi.hoisted(() => ({
  insight: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('@/lib/prisma', () => ({ default: { client: prismaMock } }));

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const query = {
  version: 1,
  projectId,
  mode: 'trend',
  range: {
    startAt: '2026-03-01T00:00:00.000Z',
    endAt: '2026-03-10T00:00:00.000Z',
    timezone: 'UTC',
    unit: 'day',
  },
  measure: { source: 'event', key: 'signup', aggregation: 'count' },
  filters: [],
  match: 'all',
  comparison: 'none',
  visualization: 'line',
};
const record = {
  id: '10000000-0000-4000-8000-000000000001',
  projectId,
  ownerId: '10000000-0000-4000-8000-000000000002',
  title: 'Activation',
  description: '',
  queryVersion: 1,
  query,
  visualization: { type: 'line' },
  status: 'active',
  favorite: false,
  createdAt: new Date('2026-03-10T00:00:00.000Z'),
  updatedAt: new Date('2026-03-10T00:00:00.000Z'),
  owner: { id: '10000000-0000-4000-8000-000000000002', username: 'owner' },
};
const access = {
  actorUserId: '10000000-0000-4000-8000-000000000003',
  projectId,
  tenantId: projectId,
  permissionScope: 'identity-sensitive',
  canCreate: true,
  canManageAll: false,
};

beforeEach(() => vi.clearAllMocks());

describe('Insight role rules', () => {
  test.each([
    [{ isAdmin: true, isProjectOwner: false, globalRole: 'admin' }, true, true],
    [{ isAdmin: false, isProjectOwner: true, globalRole: 'user' }, true, true],
    [
      { isAdmin: false, isProjectOwner: false, globalRole: 'user', teamRole: 'team-member' },
      true,
      false,
    ],
    [
      { isAdmin: false, isProjectOwner: false, globalRole: 'user', teamRole: 'team-view-only' },
      false,
      false,
    ],
    [{ isAdmin: false, isProjectOwner: true, globalRole: 'view-only' }, false, false],
  ])('derives create/manage capabilities', (input, canCreate, canManageAll) => {
    expect(deriveInsightCapabilities(input)).toEqual({ canCreate, canManageAll });
  });
});

describe('Insight persistence boundary', () => {
  test('round-trips cursor and rejects an invalid cursor', () => {
    const cursor = { updatedAt: '2026-03-10T00:00:00.000Z', id: record.id };
    expect(decodeInsightCursor(encodeInsightCursor(cursor))).toEqual(cursor);
    expect(() => decodeInsightCursor('broken')).toThrow(InvalidInsightCursorError);
  });

  test('fails stale query versions safely without an implicit migration', () => {
    expect(toInsightDto({ ...record, queryVersion: 99 } as any)).toMatchObject({
      query: null,
      compatibility: { state: 'unsupported' },
    });
  });

  test('combines search and cursor predicates and emits a cursor page', async () => {
    prismaMock.insight.findMany.mockResolvedValue([
      record,
      { ...record, id: '10000000-0000-4000-8000-000000000004' },
    ]);
    const page = await listInsights({ access, search: 'activation', limit: 1 });
    expect(page.data).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();
    expect(prismaMock.insight.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId, AND: expect.any(Array) }),
        take: 2,
      }),
    );
  });

  test('duplicates a deep-isolated normalized query under the actor', async () => {
    prismaMock.insight.findFirst.mockResolvedValue(record);
    prismaMock.insight.create.mockImplementation(async ({ data }: any) => ({
      ...record,
      ...data,
      id: '10000000-0000-4000-8000-000000000005',
      owner: { id: access.actorUserId, username: 'actor' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const copy = await duplicateInsight(access, record.id);
    const data = prismaMock.insight.create.mock.calls[0][0].data;
    expect(copy).toMatchObject({ title: 'Copy of Activation', favorite: false });
    expect(data.ownerId).toBe(access.actorUserId);
    expect(data.query).not.toBe(record.query);
    expect(data.query).toEqual(query);
  });
});
