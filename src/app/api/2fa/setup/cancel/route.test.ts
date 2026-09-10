import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  deleteMany: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/lib/prisma', () => ({
  default: { client: { twoFactorAuth: { deleteMany: mocks.deleteMany } } },
}));
vi.mock('@/server/auth/audit', () => ({ recordSecurityAuditEvent: mocks.audit }));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseRequest.mockResolvedValue({ auth: { user: { id: 'user-1' } }, error: undefined });
  mocks.deleteMany.mockResolvedValue({ count: 1 });
});

test('cancel removes only pending setup and audits the sensitive state change', async () => {
  const response = await POST(
    new Request('http://localhost/api/2fa/setup/cancel', { method: 'POST' }),
  );

  expect(response.status).toBe(200);
  expect(mocks.deleteMany).toHaveBeenCalledWith({
    where: { userId: 'user-1', isEnabled: false },
  });
  expect(mocks.audit).toHaveBeenCalledWith({
    actorUserId: 'user-1',
    eventType: 'auth.two_factor.setup.cancel',
    outcome: 'success',
    metadata: { pendingSetupRemoved: true },
  });
});
