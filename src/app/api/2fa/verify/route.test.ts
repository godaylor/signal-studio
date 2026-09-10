import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  parsePartial: vi.fn(),
  tokenMatchesUser: vi.fn(),
  issueAuth: vi.fn(),
  getUser: vi.fn(),
  getTeams: vi.fn(),
  findTwoFactor: vi.fn(),
  findBackupCodes: vi.fn(),
  consumeBackupCode: vi.fn(),
  verifyBackupCode: vi.fn(),
  parseRequest: vi.fn(),
  isConfigured: vi.fn(),
  checkRateLimit: vi.fn(),
  recordFailedAttempt: vi.fn(),
  resetRateLimit: vi.fn(),
  isOtpReplayed: vi.fn(),
  markOtpUsed: vi.fn(),
  decryptSecret: vi.fn(),
  verifyTotp: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getBearerToken: mocks.getBearerToken }));
vi.mock('@/server/auth/tokens', () => ({
  parsePartialAuthToken: mocks.parsePartial,
  tokenMatchesUser: mocks.tokenMatchesUser,
  issueAuthToken: mocks.issueAuth,
}));
vi.mock('@/queries/prisma', () => ({
  getUser: mocks.getUser,
  getAllUserTeams: mocks.getTeams,
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      twoFactorAuth: { findUnique: mocks.findTwoFactor },
      twoFactorBackupCode: {
        findMany: mocks.findBackupCodes,
        updateMany: mocks.consumeBackupCode,
      },
    },
  },
}));
vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
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
vi.mock('@/lib/two-factor/backup-codes', () => ({ verifyBackupCode: mocks.verifyBackupCode }));
vi.mock('@/server/auth/audit', () => ({ recordSecurityAuditEvent: mocks.audit }));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBearerToken.mockReturnValue('partial-token');
  mocks.parsePartial.mockReturnValue({ userId: 'user-1', pwd: 'pwd', sv: 2 });
  mocks.tokenMatchesUser.mockReturnValue(true);
  mocks.getUser.mockResolvedValue({
    id: 'user-1',
    username: 'alice',
    role: 'admin',
    password: 'hash',
    sessionVersion: 2,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  });
  mocks.getTeams.mockResolvedValue([]);
  mocks.findTwoFactor.mockResolvedValue({ isEnabled: true, secret: 'encrypted' });
  mocks.findBackupCodes.mockResolvedValue([{ id: 'backup-1', codeHash: 'hash-1' }]);
  mocks.consumeBackupCode.mockResolvedValue({ count: 1 });
  mocks.verifyBackupCode.mockResolvedValue(0);
  mocks.parseRequest.mockResolvedValue({ body: { token: '123456' }, error: undefined });
  mocks.isConfigured.mockReturnValue(true);
  mocks.checkRateLimit.mockResolvedValue({ allowed: true });
  mocks.recordFailedAttempt.mockResolvedValue({});
  mocks.isOtpReplayed.mockResolvedValue(false);
  mocks.decryptSecret.mockReturnValue('plain-secret');
  mocks.verifyTotp.mockResolvedValue(true);
  mocks.issueAuth.mockReturnValue('full-token');
});

test('rotates a current partial token into an AAL2 full token after OTP', async () => {
  const response = await POST(
    new Request('http://localhost/api/2fa/verify', {
      method: 'POST',
      headers: { authorization: 'Bearer partial-token' },
    }),
  );

  expect(mocks.issueAuth).toHaveBeenCalledWith(expect.any(Object), 2);
  expect(mocks.markOtpUsed).toHaveBeenCalledWith('user-1', '123456');
  await expect(response.json()).resolves.toMatchObject({ token: 'full-token' });
});

test('rejects a partial token invalidated by password/session version change', async () => {
  mocks.tokenMatchesUser.mockReturnValue(false);

  const response = await POST(new Request('http://localhost/api/2fa/verify', { method: 'POST' }));

  expect(response.status).toBe(401);
  expect(mocks.verifyTotp).not.toHaveBeenCalled();
});

test('rejects replay of an already used OTP before issuing full authorization', async () => {
  mocks.isOtpReplayed.mockResolvedValue(true);

  const response = await POST(new Request('http://localhost/api/2fa/verify', { method: 'POST' }));

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: 'two-factor-error-code-used' },
  });
  expect(mocks.issueAuth).not.toHaveBeenCalled();
  expect(mocks.audit).toHaveBeenCalledWith({
    actorUserId: 'user-1',
    eventType: 'auth.two_factor.verify',
    outcome: 'failure',
    metadata: { reason: 'otp_replayed' },
  });
});

test('consumes an unused backup code before issuing an AAL2 full token', async () => {
  mocks.parseRequest.mockResolvedValue({
    body: { backupCode: 'BACKUP-CODE' },
    error: undefined,
  });

  const response = await POST(new Request('http://localhost/api/2fa/verify', { method: 'POST' }));

  expect(mocks.verifyBackupCode).toHaveBeenCalledWith('BACKUP-CODE', ['hash-1']);
  expect(mocks.consumeBackupCode).toHaveBeenCalledWith({
    where: { id: 'backup-1', used: false },
    data: { used: true },
  });
  expect(mocks.issueAuth).toHaveBeenCalledWith(expect.any(Object), 2);
  await expect(response.json()).resolves.toMatchObject({ token: 'full-token' });
});

test('rejects a backup code lost to a concurrent one-time consumption race', async () => {
  mocks.parseRequest.mockResolvedValue({
    body: { backupCode: 'BACKUP-CODE' },
    error: undefined,
  });
  mocks.consumeBackupCode.mockResolvedValue({ count: 0 });

  const response = await POST(new Request('http://localhost/api/2fa/verify', { method: 'POST' }));

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: 'two-factor-error-invalid-backup-code' },
  });
  expect(mocks.recordFailedAttempt).toHaveBeenCalledWith('user-1');
  expect(mocks.issueAuth).not.toHaveBeenCalled();
});
