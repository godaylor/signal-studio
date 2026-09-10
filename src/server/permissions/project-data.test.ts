import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getProjectDataScope, PROJECT_DATA_SCOPES } from './project-data';

const { findFirstMock } = vi.hoisted(() => ({ findFirstMock: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      website: { findFirst: findFirstMock },
    },
  },
}));

const projectId = '11111111-1111-4111-8111-111111111111';
const user = { id: 'user-1', username: 'analyst', role: 'user', isAdmin: false };

describe('project identity data scope', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  test('denies unauthenticated and share-only access without querying identity data', async () => {
    await expect(getProjectDataScope(undefined, projectId)).resolves.toBe(
      PROJECT_DATA_SCOPES.deny,
    );
    await expect(
      getProjectDataScope({ shareToken: { websiteId: projectId } }, projectId),
    ).resolves.toBe(PROJECT_DATA_SCOPES.deny);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  test('grants sensitive scope to global admins and direct owners', async () => {
    findFirstMock.mockResolvedValue({
      id: projectId,
      userId: 'other-user',
      teamId: null,
      team: null,
    });
    await expect(
      getProjectDataScope({ user: { ...user, isAdmin: true } }, projectId),
    ).resolves.toBe(PROJECT_DATA_SCOPES.sensitive);

    findFirstMock.mockResolvedValue({ id: projectId, userId: user.id, teamId: null, team: null });
    await expect(getProjectDataScope({ user }, projectId)).resolves.toBe(
      PROJECT_DATA_SCOPES.sensitive,
    );
  });

  test.each([
    ['team-owner', PROJECT_DATA_SCOPES.sensitive],
    ['team-manager', PROJECT_DATA_SCOPES.standard],
    ['team-member', PROJECT_DATA_SCOPES.aggregate],
    ['team-view-only', PROJECT_DATA_SCOPES.aggregate],
  ])('maps %s to %s', async (role, expected) => {
    findFirstMock.mockResolvedValue({
      id: projectId,
      userId: null,
      teamId: 'workspace-1',
      team: {
        members: [
          { id: 'membership-1', role, studioRole: null, capabilityOverrides: {} },
        ],
      },
    });

    await expect(getProjectDataScope({ user }, projectId)).resolves.toBe(expected);
  });

  test('denies foreign projects and missing membership', async () => {
    findFirstMock.mockResolvedValue({ userId: 'other-user', team: { members: [] } });
    await expect(getProjectDataScope({ user }, projectId)).resolves.toBe(
      PROJECT_DATA_SCOPES.deny,
    );
  });
});
