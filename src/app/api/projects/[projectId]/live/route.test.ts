import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { liveSnapshotService } from '@/server/live/live-snapshot-service';
import { getAnalysisAccess } from '@/server/permissions/analysis';
import { GET } from './route';

vi.mock('@/lib/request', () => ({ parseRequest: vi.fn() }));
vi.mock('@/server/permissions/analysis', () => ({ getAnalysisAccess: vi.fn() }));
vi.mock('@/server/live/live-snapshot-service', () => ({ liveSnapshotService: { execute: vi.fn() } }));

const projectId = '11111111-1111-4111-8111-111111111111';
const parseRequestMock = vi.mocked(parseRequest);
const getAccessMock = vi.mocked(getAnalysisAccess);
const executeMock = vi.mocked(liveSnapshotService.execute);

describe('GET /api/projects/:projectId/live', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseRequestMock.mockResolvedValue({ auth: { user: { id: 'user-1' } }, error: undefined });
  });

  test('denies before entering the snapshot/cache boundary', async () => {
    getAccessMock.mockResolvedValue(null);
    const response = await GET(new Request(`http://localhost/api/projects/${projectId}/live`), { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(403);
    expect(executeMock).not.toHaveBeenCalled();
  });

  test('passes authorized tenant and permission scope into the shared key', async () => {
    getAccessMock.mockResolvedValue({ projectId, tenantId: 'workspace-a', permissionScope: 'identity-standard' });
    executeMock.mockResolvedValue({ version: 1 } as never);
    const request = new Request(`http://localhost/api/projects/${projectId}/live`, { headers: { 'x-request-id': 'request-13' } });
    const response = await GET(request, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(200);
    expect(executeMock).toHaveBeenCalledWith({ projectId, tenantId: 'workspace-a', permissionScope: 'identity-standard', requestId: 'request-13' });
  });

  test('uses a safe retryable envelope without leaking server errors', async () => {
    getAccessMock.mockResolvedValue({ projectId, tenantId: 'workspace-a', permissionScope: 'identity-standard' });
    executeMock.mockRejectedValue(new Error('secret database detail'));
    const response = await GET(new Request(`http://localhost/api/projects/${projectId}/live`), { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload).toMatchObject({ error: { code: 'live-snapshot-unavailable' } });
    expect(JSON.stringify(payload)).not.toContain('secret database detail');
  });
});
