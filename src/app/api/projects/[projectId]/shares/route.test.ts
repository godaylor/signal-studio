import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAFE_SHARE_SCOPE } from '@/server/shares/contracts';

const mocks = vi.hoisted(() => ({
  createStudioShare: vi.fn(),
  parseRequest: vi.fn(),
  recordSecurityAuditEvent: vi.fn(),
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/server/auth/audit', () => ({
  recordSecurityAuditEvent: mocks.recordSecurityAuditEvent,
}));
vi.mock('@/server/shares/share-service', () => ({
  createStudioShare: mocks.createStudioShare,
  listStudioShares: vi.fn(),
  StudioShareForbiddenError: class StudioShareForbiddenError extends Error {},
  StudioShareNotFoundError: class StudioShareNotFoundError extends Error {},
  StudioShareValidationError: class StudioShareValidationError extends Error {},
}));

import { POST } from './route';

describe('POST /api/projects/:projectId/shares audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseRequest.mockResolvedValue({
      auth: { user: { id: 'actor-1' } },
      body: {
        resourceType: 'insight',
        resourceId: 'insight-1',
        name: 'Safe share',
        visibility: 'public',
        expiresAt: '2026-09-05T00:00:00.000Z',
        scope: SAFE_SHARE_SCOPE,
      },
      error: null,
    });
    mocks.createStudioShare.mockResolvedValue({
      id: 'share-1',
      resourceType: 'insight',
      visibility: 'public',
    });
  });

  it('records share creation with project and scope-safe resource metadata', async () => {
    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ projectId: 'project-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.recordSecurityAuditEvent).toHaveBeenCalledWith({
      actorUserId: 'actor-1',
      eventType: 'studio-share.created',
      outcome: 'success',
      metadata: {
        projectId: 'project-1',
        shareId: 'share-1',
        resourceType: 'insight',
        visibility: 'public',
      },
    });
  });
});
