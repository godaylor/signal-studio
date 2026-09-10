import { beforeEach, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { createInsight } from '@/server/insights/insight-service';
import { getInsightAccess } from '@/server/permissions/insights';
import { POST } from './route';

vi.mock('@/lib/request', () => ({ parseRequest: vi.fn() }));
vi.mock('@/server/auth/audit', () => ({ recordSecurityAuditEvent: vi.fn() }));
vi.mock('@/server/permissions/insights', () => ({ getInsightAccess: vi.fn() }));
vi.mock('@/server/insights/insight-service', () => ({
  INSIGHT_STATUSES: ['active', 'archived'],
  createInsight: vi.fn(),
  listInsights: vi.fn(),
}));

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const access = {
  actorUserId: '10000000-0000-4000-8000-000000000001',
  projectId,
  tenantId: projectId,
  permissionScope: 'identity-sensitive',
  canCreate: true,
  canManageAll: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(parseRequest).mockResolvedValue({
    auth: { user: { id: access.actorUserId } },
    body: { title: 'Activation', query: { version: 1 } },
    error: undefined,
  });
  vi.mocked(getInsightAccess).mockResolvedValue(access);
});

test('create route records a safe audit event after persistence', async () => {
  vi.mocked(createInsight).mockResolvedValue({ id: '10000000-0000-4000-8000-000000000002' } as any);
  const response = await POST(
    new Request(`http://localhost/api/projects/${projectId}/insights`, { method: 'POST' }),
    { params: Promise.resolve({ projectId }) },
  );
  expect(response.status).toBe(200);
  expect(recordSecurityAuditEvent).toHaveBeenCalledWith({
    actorUserId: access.actorUserId,
    eventType: 'insight.created',
    outcome: 'success',
    metadata: { projectId, insightId: '10000000-0000-4000-8000-000000000002' },
  });
});

test('create route denies an authenticated user without project access', async () => {
  vi.mocked(getInsightAccess).mockResolvedValue(null);
  const response = await POST(
    new Request(`http://localhost/api/projects/${projectId}/insights`, { method: 'POST' }),
    { params: Promise.resolve({ projectId }) },
  );
  expect(response.status).toBe(403);
  expect(createInsight).not.toHaveBeenCalled();
});
