import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createDashboard, DashboardForbiddenError, updateDashboard } from './dashboard-service';

const prismaMock = vi.hoisted(() => ({
  studioDashboard: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: { client: prismaMock },
}));

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const actorUserId = '10000000-0000-4000-8000-000000000001';
const otherUserId = '10000000-0000-4000-8000-000000000002';
const baseAccess = {
  actorUserId,
  projectId,
  tenantId: projectId,
  permissionScope: 'identity-sensitive',
  canCreate: true,
  canManageAll: false,
};
const record = {
  id: '20000000-0000-4000-8000-000000000001',
  projectId,
  ownerId: otherUserId,
  owner: { id: otherUserId, username: 'owner' },
  title: 'Activation dashboard',
  description: '',
  globalContext: {},
  sharePolicy: { mode: 'private', version: 1 },
  widgets: [],
  createdAt: new Date('2026-03-10T00:00:00.000Z'),
  updatedAt: new Date('2026-03-10T00:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.studioDashboard.findFirst.mockResolvedValue({
    id: record.id,
    ownerId: record.ownerId,
  });
  prismaMock.studioDashboard.update.mockResolvedValue(record);
});

describe('Dashboard permission matrix', () => {
  test('view-only access cannot create a dashboard', async () => {
    await expect(
      createDashboard({
        access: { ...baseAccess, canCreate: false },
        title: 'Denied',
      }),
    ).rejects.toBeInstanceOf(DashboardForbiddenError);
    expect(prismaMock.studioDashboard.create).not.toHaveBeenCalled();
  });

  test.each([
    ['admin or manager', { canCreate: true, canManageAll: true }, otherUserId, true],
    ['member editing own', { canCreate: true, canManageAll: false }, actorUserId, true],
    ['member editing another', { canCreate: true, canManageAll: false }, otherUserId, false],
    ['view-only editing another', { canCreate: false, canManageAll: false }, otherUserId, false],
  ])('%s dashboard', async (_label, capabilities, ownerId, allowed) => {
    prismaMock.studioDashboard.findFirst.mockResolvedValue({ id: record.id, ownerId });
    const operation = updateDashboard({
      access: { ...baseAccess, ...capabilities },
      dashboardId: record.id,
      title: 'Updated',
    });

    if (allowed) {
      await expect(operation).resolves.toMatchObject({ id: record.id });
      expect(prismaMock.studioDashboard.update).toHaveBeenCalledOnce();
    } else {
      await expect(operation).rejects.toBeInstanceOf(DashboardForbiddenError);
      expect(prismaMock.studioDashboard.update).not.toHaveBeenCalled();
    }
  });
});
