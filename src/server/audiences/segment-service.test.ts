import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  deleteOperationalSegment,
  OperationalSegmentDependencyError,
  previewOperationalSegment,
} from './segment-service';

const mocks = vi.hoisted(() => ({
  segmentFindFirst: vi.fn(),
  segmentDelete: vi.fn(),
  insightFindMany: vi.fn(),
  trackedUserFindMany: vi.fn(),
  trackedAccountFindMany: vi.fn(),
  rawQuery: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      segment: { findFirst: mocks.segmentFindFirst, delete: mocks.segmentDelete },
      insight: { findMany: mocks.insightFindMany },
      trackedUser: { findMany: mocks.trackedUserFindMany },
      trackedAccount: { findMany: mocks.trackedAccountFindMany },
    },
    rawQuery: mocks.rawQuery,
  },
}));

const access = {
  actorUserId: 'actor',
  projectId: '11111111-1111-4111-8111-111111111111',
  tenantId: 'tenant',
  permissionScope: 'identity-sensitive',
  canCreate: true,
  canManageAll: true,
};

describe('operational Segment service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insightFindMany.mockResolvedValue([]);
    mocks.trackedAccountFindMany.mockResolvedValue([]);
    mocks.rawQuery.mockResolvedValue([{ id: 'user-1' }]);
    mocks.trackedUserFindMany.mockResolvedValue([
      {
        id: 'user-1',
        externalId: 'alice',
        displayName: 'Alice',
        traits: { plan: 'enterprise' },
        lifecycleStage: 'activated',
      },
      {
        id: 'user-2',
        externalId: 'bob',
        displayName: 'Bob',
        traits: { plan: 'starter' },
        lifecycleStage: 'onboarding',
      },
    ]);
  });

  test('evaluates all/any trait and behavior rules with exact timestamped samples', async () => {
    const all = await previewOperationalSegment(access, {
      version: 1,
      entity: 'user',
      match: 'all',
      conditions: [
        { kind: 'trait', field: 'plan', operator: 'equals', value: 'enterprise' },
        { kind: 'behavior', eventName: 'core_feature_used', withinDays: 30, minCount: 1 },
      ],
    });
    expect(all).toMatchObject({ exactness: 'exact', count: 1 });
    expect(all.sample[0]).toMatchObject({ id: 'user-1', label: 'Alice' });

    const any = await previewOperationalSegment(access, {
      version: 1,
      entity: 'user',
      match: 'any',
      conditions: [
        { kind: 'lifecycle', value: 'onboarding' },
        { kind: 'behavior', eventName: 'core_feature_used', withinDays: 30, minCount: 1 },
      ],
    });
    expect(any.count).toBe(2);
  });

  test('masks sample identity labels for standard scope', async () => {
    const result = await previewOperationalSegment(
      { ...access, permissionScope: 'identity-standard' },
      {
        version: 1,
        entity: 'user',
        match: 'all',
        conditions: [{ kind: 'lifecycle', value: 'activated' }],
      },
    );
    expect(result.sample[0].label).toBe('Tracked user user-1');
  });

  test('blocks delete and returns dependencies before destructive mutation', async () => {
    mocks.segmentFindFirst.mockResolvedValue({
      id: 'segment-1',
      websiteId: access.projectId,
      name: 'Activated users',
      parameters: {
        version: 1,
        entity: 'user',
        match: 'all',
        conditions: [{ kind: 'lifecycle', value: 'activated' }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mocks.insightFindMany.mockResolvedValue([
      {
        id: 'insight-1',
        title: 'Activation retention',
        query: { retention: { cohortId: 'segment-1' } },
        _count: { dashboardWidgets: 2 },
      },
    ]);
    await expect(deleteOperationalSegment(access, 'segment-1')).rejects.toMatchObject({
      dependencies: { insights: [{ id: 'insight-1' }], dashboards: 2 },
    });
    expect(mocks.segmentDelete).not.toHaveBeenCalled();
    expect(OperationalSegmentDependencyError).toBeDefined();
  });
});
