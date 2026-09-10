import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), resolve: vi.fn() }));
vi.mock('@/queries/prisma', () => ({ getShareByCode: mocks.get }));
vi.mock('@/server/shares/share-service', () => ({
  resolveStudioShare: mocks.resolve,
  StudioShareNotFoundError: class extends Error {},
}));
import { GET } from './route';

beforeEach(() => vi.clearAllMocks());
test.each(['website', 'board', 'pixel', 'link', null])('retires legacy %s without issuing a token', async resourceType => {
  mocks.get.mockResolvedValue({ id: 'legacy', resourceType });
  const response = await GET(new Request('http://127.0.0.1:32169/api/share/old'), { params: Promise.resolve({ slug: 'old' }) });
  expect(response.status).toBe(410);
  expect(await response.json()).toEqual({ error: { code: 'legacy-share-retired' } });
  expect(mocks.resolve).not.toHaveBeenCalled();
});
test('preserves Studio sharing through its live-record resolver', async () => {
  mocks.get.mockResolvedValue({ id: 'new', resourceType: 'insight' });
  mocks.resolve.mockResolvedValue({ token: 'scoped-token' });
  const response = await GET(new Request('http://127.0.0.1:32169/api/share/new'), { params: Promise.resolve({ slug: 'new' }) });
  expect(response.status).toBe(200);
  expect(mocks.resolve).toHaveBeenCalledOnce();
});
