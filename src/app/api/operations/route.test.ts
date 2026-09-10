import { beforeEach, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { exportDb } from '@/server/exports/database';
import { GET } from './route';
const mocks = vi.hoisted(() => ({ groupBy: vi.fn() }));
vi.mock('@/lib/request', () => ({ parseRequest: vi.fn() }));
vi.mock('@/server/exports/database', () => ({ exportDb: { exportJob: { groupBy: mocks.groupBy } } }));
vi.mock('@/server/live/live-snapshot-service', () => ({ liveSnapshotService: { metrics: () => ({ hits: 0 }) } }));
beforeEach(() => vi.clearAllMocks());
test('honors common authentication / assurance rejection', async () => {
  vi.mocked(parseRequest).mockResolvedValue({ error: () => new Response(null, { status: 401 }) } as any);
  expect((await GET(new Request('http://localhost/api/operations'))).status).toBe(401);
  expect(exportDb.exportJob.groupBy).not.toHaveBeenCalled();
});
test('project owners cannot see process-wide other-tenant counters', async () => {
  vi.mocked(parseRequest).mockResolvedValue({ auth: { user: { isAdmin: false } } } as any);
  expect((await GET(new Request('http://localhost/api/operations'))).status).toBe(403);
  expect(exportDb.exportJob.groupBy).not.toHaveBeenCalled();
});
test('system administrator gets a private non-cacheable snapshot', async () => {
  vi.mocked(parseRequest).mockResolvedValue({ auth: { user: { isAdmin: true } } } as any);
  mocks.groupBy.mockResolvedValue([]);
  const response = await GET(new Request('http://localhost/api/operations'));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect((await response.json()).scope).toBe('this-process-since-start');
});
