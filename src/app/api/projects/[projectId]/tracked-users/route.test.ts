import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { listTrackedUsers } from '@/server/identities/read-service';
import { deriveStudioCapabilities, resolveProjectAccess } from '@/server/permissions/capabilities';
import { GET } from './route';

vi.mock('@/lib/request', () => ({ parseRequest: vi.fn() }));
vi.mock('@/server/identities/read-service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/server/identities/read-service')>();
  return { ...actual, listTrackedUsers: vi.fn() };
});
vi.mock('@/server/permissions/capabilities', async importOriginal => {
  const actual = await importOriginal<typeof import('@/server/permissions/capabilities')>();
  return { ...actual, resolveProjectAccess: vi.fn() };
});

const parseRequestMock = vi.mocked(parseRequest);
const resolveProjectAccessMock = vi.mocked(resolveProjectAccess);
const listTrackedUsersMock = vi.mocked(listTrackedUsers);
const projectId = '11111111-1111-4111-8111-111111111111';

describe('GET /api/projects/:projectId/tracked-users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseRequestMock.mockResolvedValue({
      auth: {
        user: { id: 'user-1', username: 'viewer', role: 'user', isAdmin: false },
      },
      query: { limit: 25 },
      error: undefined,
    });
  });

  test('denies direct API access before reading identity rows', async () => {
    resolveProjectAccessMock.mockResolvedValue(null);

    const response = await GET(new Request(`http://localhost/api/projects/${projectId}/users`), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(403);
    expect(listTrackedUsersMock).not.toHaveBeenCalled();
  });

  test('passes the authorized field scope to the bounded cursor service', async () => {
    resolveProjectAccessMock.mockResolvedValue({ capabilities: deriveStudioCapabilities('analyst') } as Awaited<ReturnType<typeof resolveProjectAccess>>);
    listTrackedUsersMock.mockResolvedValue({
      data: [{ id: 'tracked-1' }],
      nextCursor: null,
    } as any);

    const response = await GET(new Request(`http://localhost/api/projects/${projectId}/users`), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(200);
    expect(listTrackedUsersMock).toHaveBeenCalledWith({
      projectId,
      scope: 'identity-standard',
      cursor: undefined,
      limit: 25,
      search: undefined,
      sort: undefined,
      direction: undefined,
      lifecycle: undefined,
    });
    await expect(response.json()).resolves.toEqual({
      data: [{ id: 'tracked-1' }],
      nextCursor: null,
      permissionScope: 'identity-standard',
    });
  });
});
