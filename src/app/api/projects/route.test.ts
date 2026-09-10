import { beforeEach, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { listProjects } from '@/server/projects/project-service';
import { GET } from './route';

vi.mock('@/lib/request', () => ({ parseRequest: vi.fn() }));
vi.mock('@/server/projects/project-service', () => ({ listProjects: vi.fn() }));

const parseRequestMock = vi.mocked(parseRequest);
const listProjectsMock = vi.mocked(listProjects);

beforeEach(() => {
  vi.clearAllMocks();
});

test('returns only projects selected by the server-side facade service', async () => {
  const auth = {
    user: { id: 'user-1', username: 'owner', role: 'user', isAdmin: false },
  };
  parseRequestMock.mockResolvedValue({ auth, error: undefined });
  listProjectsMock.mockResolvedValue([
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Demo',
      workspaceId: null,
      permissionScope: 'identity-sensitive',
      source: { id: '11111111-1111-4111-8111-111111111111', type: 'website', domain: null },
    },
  ]);

  const response = await GET(new Request('http://localhost/api/projects'));

  expect(response.status).toBe(200);
  expect(listProjectsMock).toHaveBeenCalledWith(auth);
  await expect(response.json()).resolves.toMatchObject({
    data: [{ name: 'Demo', source: { type: 'website' } }],
  });
});
