import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GET } from './route';
import { parseRequest } from '@/lib/request';
import { resolveProjectAccess } from '@/server/permissions/capabilities';
import { getHomeSnapshot } from '@/server/home/service';
vi.mock('@/lib/request', () => ({ parseRequest: vi.fn() }));
vi.mock('@/server/permissions/capabilities', () => ({ resolveProjectAccess: vi.fn() }));
vi.mock('@/server/home/service', () => ({ getHomeSnapshot: vi.fn() }));
const projectId = '11111111-1111-4111-8111-111111111111';
const request = new Request('http://localhost/api/projects/' + projectId + '/home');
describe('Home common guard and project authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(parseRequest).mockResolvedValue({ auth: { user: { id: 'owner' } } } as any);
    vi.mocked(resolveProjectAccess).mockResolvedValue(null);
  });
  test('honors common auth and required-2FA rejection without loading data', async () => {
    vi.mocked(parseRequest).mockResolvedValue({ error: () => new Response(null, { status: 401 }) } as any);
    expect((await GET(request, { params: Promise.resolve({ projectId }) })).status).toBe(401);
    expect(getHomeSnapshot).not.toHaveBeenCalled();
    expect(resolveProjectAccess).not.toHaveBeenCalled();
  });
  test('rejects another project without loading Home data', async () => {
    expect((await GET(request, { params: Promise.resolve({ projectId }) })).status).toBe(403);
    expect(getHomeSnapshot).not.toHaveBeenCalled();
  });
  test('returns only the permission-aware snapshot with private no-store', async () => {
    const access = { capabilities: { viewAggregate: true, viewIdentity: false } };
    vi.mocked(resolveProjectAccess).mockResolvedValue(access as any);
    vi.mocked(getHomeSnapshot).mockResolvedValue({ atRisk: { permitted: false, accounts: [] } } as any);
    const response = await GET(request, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(getHomeSnapshot).toHaveBeenCalledWith(access, request.signal);
  });
});
