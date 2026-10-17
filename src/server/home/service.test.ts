import { beforeEach, describe, expect, test, vi } from 'vitest';
import { analysisQueryService } from '@/server/analytics/query-service';
import { deriveStudioCapabilities, type ProjectAccess } from '@/server/permissions/capabilities';
import { getHomeSnapshot } from './service';

const db = vi.hoisted(() => ({
  health: vi.fn(),
  currencies: vi.fn(),
  accounts: vi.fn(),
  insights: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    rawQuery: db.health,
    client: {
      revenue: { findMany: db.currencies },
      trackedAccount: { findMany: db.accounts },
      insight: { findMany: db.insights },
    },
  },
}));
vi.mock('@/server/analytics/query-service', () => ({
  analysisQueryService: { execute: vi.fn() },
}));

const access: ProjectAccess = {
  actorUserId: 'analyst',
  projectId: '11111111-1111-4111-8111-111111111111',
  workspaceId: 'workspace',
  membershipId: 'member',
  legacyRole: 'team-member',
  studioRole: 'analyst',
  capabilities: deriveStudioCapabilities('analyst'),
  isSystemAdmin: false,
  isDirectOwner: false,
};
const now = new Date('2026-10-18T00:00:00Z');

describe('Home cancellation bounds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.currencies.mockResolvedValue([]);
    db.health.mockResolvedValue([{ latest: null, recent: 0n }]);
    db.accounts.mockResolvedValue([]);
    db.insights.mockResolvedValue([]);
  });

  test('an already cancelled request starts no database work', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(getHomeSnapshot(access, controller.signal, now)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(db.currencies).not.toHaveBeenCalled();
    expect(analysisQueryService.execute).not.toHaveBeenCalled();
    expect(db.health).not.toHaveBeenCalled();
    expect(db.accounts).not.toHaveBeenCalled();
    expect(db.insights).not.toHaveBeenCalled();
  });

  test('cancellation after the last cached metric never starts supplementary reads', async () => {
    const controller = new AbortController();
    let completed = 0;
    vi.mocked(analysisQueryService.execute).mockImplementation(async () => {
      completed += 1;
      // A cache hit can settle while the caller has just been cancelled.
      if (completed === 6) controller.abort();
      return {} as Awaited<ReturnType<typeof analysisQueryService.execute>>;
    });

    await expect(getHomeSnapshot(access, controller.signal, now)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(analysisQueryService.execute).toHaveBeenCalledTimes(6);
    expect(db.health).not.toHaveBeenCalled();
    expect(db.accounts).not.toHaveBeenCalled();
    expect(db.insights).not.toHaveBeenCalled();
  });

  test('a normal request retains serial metrics and aggregate-only permissions', async () => {
    let active = 0;
    let peak = 0;
    vi.mocked(analysisQueryService.execute).mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return {} as Awaited<ReturnType<typeof analysisQueryService.execute>>;
    });

    const result = await getHomeSnapshot(
      { ...access, capabilities: deriveStudioCapabilities('viewer') },
      undefined,
      now,
    );

    expect(peak).toBe(1);
    expect(result.metrics.map(metric => metric.id)).toEqual([
      'activation',
      'retention',
      'signups',
      'users',
      'accounts',
      'adoption',
    ]);
    expect(analysisQueryService.execute).toHaveBeenCalledTimes(6);
    expect(analysisQueryService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: access.projectId,
        tenantId: access.workspaceId,
        permissionScope: 'aggregate-only',
      }),
    );
    expect(db.accounts).not.toHaveBeenCalled();
    expect(result.atRisk).toEqual({ permitted: false, accounts: [] });
    expect(db.health).toHaveBeenCalledTimes(1);
    expect(db.insights).toHaveBeenCalledTimes(1);
  });
});
