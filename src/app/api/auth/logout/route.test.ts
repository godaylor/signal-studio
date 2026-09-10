import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  updateUser: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/lib/prisma', () => ({
  default: { client: { user: { update: mocks.updateUser } } },
}));
vi.mock('@/server/auth/audit', () => ({ recordSecurityAuditEvent: mocks.audit }));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1' } },
    error: undefined,
  });
});

test('increments the session version so logout revokes every prior token', async () => {
  const response = await POST(new Request('http://localhost/api/auth/logout', { method: 'POST' }));

  expect(mocks.updateUser).toHaveBeenCalledWith({
    where: { id: 'user-1' },
    data: { sessionVersion: { increment: 1 } },
  });
  expect(response.status).toBe(200);
});

test('does not mutate session state when authentication fails', async () => {
  mocks.parseRequest.mockResolvedValue({
    auth: null,
    error: () => new Response(null, { status: 401 }),
  });

  const response = await POST(new Request('http://localhost/api/auth/logout', { method: 'POST' }));

  expect(mocks.updateUser).not.toHaveBeenCalled();
  expect(response.status).toBe(401);
});
