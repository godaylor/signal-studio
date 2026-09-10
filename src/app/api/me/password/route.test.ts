import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  checkPassword: vi.fn(),
  hashPassword: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/queries/prisma/user', () => ({
  getUser: mocks.getUser,
  updateUser: mocks.updateUser,
}));
vi.mock('@/lib/password', () => ({
  checkPassword: mocks.checkPassword,
  hashPassword: mocks.hashPassword,
}));
vi.mock('@/server/auth/audit', () => ({ recordSecurityAuditEvent: mocks.audit }));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1' } },
    body: { currentPassword: 'current', newPassword: 'new-password' },
    error: undefined,
  });
  mocks.getUser.mockResolvedValue({ id: 'user-1', password: 'stored-hash' });
  mocks.checkPassword.mockReturnValue(true);
  mocks.hashPassword.mockReturnValue('new-hash');
  mocks.updateUser.mockResolvedValue({ id: 'user-1' });
});

test('failed current-password verification emits a safe security audit event', async () => {
  mocks.checkPassword.mockReturnValue(false);

  const response = await POST(new Request('http://localhost/api/me/password', { method: 'POST' }));

  expect(response.status).toBe(400);
  expect(mocks.updateUser).not.toHaveBeenCalled();
  expect(mocks.audit).toHaveBeenCalledWith({
    actorUserId: 'user-1',
    eventType: 'auth.password.change',
    outcome: 'failure',
    metadata: { reason: 'incorrect_current_password' },
  });
  expect(mocks.audit.mock.calls[0][0]).not.toHaveProperty('currentPassword');
});

test('successful password change revokes sessions through updateUser and audits success', async () => {
  const response = await POST(new Request('http://localhost/api/me/password', { method: 'POST' }));

  expect(response.status).toBe(200);
  expect(mocks.updateUser).toHaveBeenCalledWith('user-1', { password: 'new-hash' });
  expect(mocks.audit).toHaveBeenCalledWith({
    actorUserId: 'user-1',
    eventType: 'auth.password.change',
    outcome: 'success',
  });
});
