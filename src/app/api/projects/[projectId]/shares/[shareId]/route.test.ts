import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  recordSecurityAuditEvent: vi.fn(),
  revokeStudioShare: vi.fn(),
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/server/auth/audit', () => ({
  recordSecurityAuditEvent: mocks.recordSecurityAuditEvent,
}));
vi.mock('@/server/shares/share-service', () => ({
  revokeStudioShare: mocks.revokeStudioShare,
  updateStudioShare: vi.fn(),
  StudioShareForbiddenError: class StudioShareForbiddenError extends Error {},
  StudioShareNotFoundError: class StudioShareNotFoundError extends Error {},
  StudioShareValidationError: class StudioShareValidationError extends Error {},
}));

import { DELETE } from './route';

describe('DELETE /api/projects/:projectId/shares/:shareId audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseRequest.mockResolvedValue({
      auth: { user: { id: 'actor-1' } },
      error: null,
    });
    mocks.revokeStudioShare.mockResolvedValue({
      id: 'share-1',
      resourceType: 'dashboard',
      revokedAt: '2026-09-04T00:00:00.000Z',
    });
  });

  it('records revocation after the live record is invalidated', async () => {
    const response = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ projectId: 'project-1', shareId: 'share-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.recordSecurityAuditEvent).toHaveBeenCalledWith({
      actorUserId: 'actor-1',
      eventType: 'studio-share.revoked',
      outcome: 'success',
      metadata: {
        projectId: 'project-1',
        shareId: 'share-1',
        resourceType: 'dashboard',
      },
    });
  });
});
