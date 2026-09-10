import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  isConfigured: vi.fn(),
  appSetting: vi.fn(),
  userPolicy: vi.fn(),
  teamUsers: vi.fn(),
  requiredTeams: vi.fn(),
  findTwoFactor: vi.fn(),
  getUser: vi.fn(),
  checkPassword: vi.fn(),
  checkRateLimit: vi.fn(),
  recordFailedAttempt: vi.fn(),
  resetRateLimit: vi.fn(),
  isOtpReplayed: vi.fn(),
  markOtpUsed: vi.fn(),
  decryptSecret: vi.fn(),
  verifyTotp: vi.fn(),
  deleteTwoFactor: vi.fn(),
  deleteBackupCodes: vi.fn(),
  transaction: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      appSetting: { findUnique: mocks.appSetting },
      user: { findUnique: mocks.userPolicy },
      teamUser: { findMany: mocks.teamUsers },
      team: { findMany: mocks.requiredTeams },
      twoFactorAuth: { findUnique: mocks.findTwoFactor },
    },
    transaction: mocks.transaction,
  },
}));
vi.mock('@/lib/two-factor/crypto', () => ({
  decryptSecret: mocks.decryptSecret,
  getTwoFactorConfigurationError: () => ({ code: 'two-factor-error-not-configured' }),
  isTwoFactorConfigured: mocks.isConfigured,
}));
vi.mock('@/lib/two-factor/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  recordFailedAttempt: mocks.recordFailedAttempt,
  resetRateLimit: mocks.resetRateLimit,
}));
vi.mock('@/lib/two-factor/replay-prevention', () => ({
  isOtpReplayed: mocks.isOtpReplayed,
  markOtpUsed: mocks.markOtpUsed,
}));
vi.mock('@/lib/two-factor/totp', () => ({ verifyTotp: mocks.verifyTotp }));
vi.mock('@/lib/password', () => ({ checkPassword: mocks.checkPassword }));
vi.mock('@/queries/prisma/user', () => ({ getUser: mocks.getUser }));
vi.mock('@/server/auth/audit', () => ({ recordSecurityAuditEvent: mocks.audit }));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1' } },
    body: { password: 'secret', token: '123456' },
    error: undefined,
  });
  mocks.isConfigured.mockReturnValue(true);
  mocks.appSetting.mockResolvedValue(null);
  mocks.userPolicy.mockResolvedValue({ twoFactorRequired: false });
  mocks.teamUsers.mockResolvedValue([]);
  mocks.requiredTeams.mockResolvedValue([]);
  mocks.getUser.mockResolvedValue({ id: 'user-1', password: 'password-hash' });
  mocks.checkPassword.mockReturnValue(true);
  mocks.findTwoFactor.mockResolvedValue({ isEnabled: true, secret: 'encrypted' });
  mocks.checkRateLimit.mockResolvedValue({ allowed: true });
  mocks.recordFailedAttempt.mockResolvedValue({});
  mocks.isOtpReplayed.mockResolvedValue(false);
  mocks.decryptSecret.mockReturnValue('plain-secret');
  mocks.verifyTotp.mockResolvedValue(true);
  mocks.transaction.mockImplementation(callback =>
    callback({
      twoFactorAuth: { delete: mocks.deleteTwoFactor },
      twoFactorBackupCode: { deleteMany: mocks.deleteBackupCodes },
    }),
  );
});

test('configuration failure is audited after authenticating the caller', async () => {
  mocks.isConfigured.mockReturnValue(false);

  const response = await POST(new Request('http://localhost/api/2fa/disable', { method: 'POST' }));

  expect(response.status).toBe(503);
  expect(mocks.audit).toHaveBeenCalledWith({
    actorUserId: 'user-1',
    eventType: 'auth.two_factor.disable',
    outcome: 'blocked',
    metadata: { reason: 'two_factor_not_configured' },
  });
});

test('successful disable deletes 2FA state and emits a safe audit event', async () => {
  const response = await POST(new Request('http://localhost/api/2fa/disable', { method: 'POST' }));

  expect(response.status).toBe(200);
  expect(mocks.markOtpUsed).toHaveBeenCalledWith('user-1', '123456', expect.any(Object));
  expect(mocks.deleteTwoFactor).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  expect(mocks.deleteBackupCodes).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  expect(mocks.audit).toHaveBeenCalledWith({
    actorUserId: 'user-1',
    eventType: 'auth.two_factor.disable',
    outcome: 'success',
  });
});
