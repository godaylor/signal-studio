import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createWorkspaceMember: vi.fn(),
  parseRequest: vi.fn(),
  recordSecurityAuditEvent: vi.fn(),
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/server/members/contracts', () => ({
  memberCreateSchema: {},
  memberListQuerySchema: {},
}));
vi.mock('@/server/auth/audit', () => ({
  recordSecurityAuditEvent: mocks.recordSecurityAuditEvent,
}));
vi.mock('@/server/members/membership-service', () => ({
  createWorkspaceMember: mocks.createWorkspaceMember,
  listWorkspaceMembers: vi.fn(),
  MembershipConflictError: class MembershipConflictError extends Error {},
  MembershipForbiddenError: class MembershipForbiddenError extends Error {},
  MembershipNotFoundError: class MembershipNotFoundError extends Error {},
}));

import { POST } from './route';

describe('POST /api/projects/:projectId/members audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseRequest.mockResolvedValue({
      auth: { user: { id: 'actor-1' } },
      body: { username: 'analyst', studioRole: 'analyst', capabilityOverrides: {} },
      error: null,
    });
    mocks.createWorkspaceMember.mockResolvedValue({
      id: 'member-1',
      studioRole: 'analyst',
    });
  });

  it('records the successful role assignment without sensitive data', async () => {
    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ projectId: 'project-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.recordSecurityAuditEvent).toHaveBeenCalledWith({
      actorUserId: 'actor-1',
      eventType: 'workspace.member-added',
      outcome: 'success',
      metadata: {
        projectId: 'project-1',
        memberId: 'member-1',
        studioRole: 'analyst',
      },
    });
  });
});
