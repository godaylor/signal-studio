import type { Auth } from '@/lib/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findProject } = vi.hoisted(() => ({
  findProject: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      website: {
        findFirst: findProject,
      },
    },
  },
}));

import {
  ROLE_CAPABILITIES,
  deriveStudioCapabilities,
  resolveProjectAccess,
} from './capabilities';

const auth = {
  user: {
    id: 'analyst-user',
    username: 'analyst@example.test',
    role: 'user',
    isAdmin: false,
  },
} as Auth;

function analystProject(capabilityOverrides: Record<string, boolean> = {}) {
  return {
    id: 'project-1',
    userId: 'owner-user',
    teamId: 'workspace-1',
    team: {
      members: [
        {
          id: 'membership-1',
          role: 'team-member',
          studioRole: 'analyst',
          capabilityOverrides,
        },
      ],
    },
  };
}

describe('Signal Studio Analyst access resolution', () => {
  beforeEach(() => {
    findProject.mockReset();
  });

  it('uses studioRole as the authority while retaining the legacy team-member value', async () => {
    findProject.mockResolvedValue(analystProject());

    const access = await resolveProjectAccess(auth, 'project-1');

    expect(access).toMatchObject({
      legacyRole: 'team-member',
      studioRole: 'analyst',
      membershipId: 'membership-1',
    });
    expect(access?.capabilities).toEqual(ROLE_CAPABILITIES.analyst);
  });

  it('does not widen Analyst through the legacy team-member role', async () => {
    findProject.mockResolvedValue(analystProject());

    const access = await resolveProjectAccess(auth, 'project-1');

    expect(access?.capabilities).toEqual(deriveStudioCapabilities('analyst'));
    expect(access?.capabilities.manageMembers).toBe(false);
    expect(access?.capabilities.manageSources).toBe(false);
    expect(access?.capabilities.manageWorkspaceSecurity).toBe(false);
    expect(access?.capabilities.viewSensitiveTraits).toBe(false);
    expect(access?.capabilities.viewReplay).toBe(false);
    expect(access?.capabilities.exportData).toBe(false);
    expect(access?.capabilities.createPublicShare).toBe(false);
  });

  it('applies individual allow and deny overrides after the Analyst defaults', async () => {
    findProject.mockResolvedValue(
      analystProject({
        editInsights: false,
        viewReplay: true,
        exportData: true,
      }),
    );

    const access = await resolveProjectAccess(auth, 'project-1');

    expect(access?.capabilities.editInsights).toBe(false);
    expect(access?.capabilities.viewReplay).toBe(true);
    expect(access?.capabilities.exportData).toBe(true);
    expect(access?.capabilities.createPublicShare).toBe(false);
  });
});
