import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getProject, listProjects } from './project-service';

const { findManyMock, findFirstMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findFirstMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      website: { findMany: findManyMock, findFirst: findFirstMock },
    },
  },
}));

const auth = {
  user: { id: 'user-1', username: 'owner', role: 'user', isAdmin: false },
};

describe('Project facade', () => {
  beforeEach(() => {
    findManyMock.mockReset();
    findFirstMock.mockReset();
  });

  test('maps Website storage to product-oriented Project and Source vocabulary', async () => {
    findManyMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Demo product',
        domain: 'demo.example.test',
        userId: 'user-1',
        teamId: null,
        team: null,
      },
    ]);

    await expect(listProjects(auth)).resolves.toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Demo product',
        workspaceId: null,
        permissionScope: 'identity-sensitive',
        source: {
          id: '11111111-1111-4111-8111-111111111111',
          type: 'website',
          domain: 'demo.example.test',
        },
      },
    ]);
    expect(findManyMock.mock.calls[0][0].where).toMatchObject({
      deletedAt: null,
      OR: expect.any(Array),
    });
  });

  test('uses the server-authorized scope for project detail', async () => {
    findFirstMock.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Demo product',
      domain: null,
      userId: null,
      teamId: 'workspace-1',
    });

    await expect(
      getProject('11111111-1111-4111-8111-111111111111', auth, 'identity-standard'),
    ).resolves.toMatchObject({
      workspaceId: 'workspace-1',
      permissionScope: 'identity-standard',
    });
  });
});
