import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  getUserByUsername: vi.fn(),
  getAllUserTeams: vi.fn(),
  checkPassword: vi.fn(),
  getPolicy: vi.fn(),
  isConfigured: vi.fn(),
  getKey: vi.fn(),
  checkLimit: vi.fn(),
  recordFailure: vi.fn(),
  resetLimit: vi.fn(),
  issueAuth: vi.fn(),
  issuePartial: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/queries/prisma', () => ({
  getUserByUsername: mocks.getUserByUsername,
  getAllUserTeams: mocks.getAllUserTeams,
}));
vi.mock('@/lib/password', () => ({ checkPassword: mocks.checkPassword }));
vi.mock('@/server/auth/two-factor-policy', () => ({ getTwoFactorPolicy: mocks.getPolicy }));
vi.mock('@/server/auth/login-rate-limit', () => ({
  getLoginRateLimitKey: mocks.getKey,
  checkLoginRateLimit: mocks.checkLimit,
  recordLoginFailure: mocks.recordFailure,
  resetLoginRateLimit: mocks.resetLimit,
}));
vi.mock('@/server/auth/tokens', () => ({
  issueAuthToken: mocks.issueAuth,
  issuePartialAuthToken: mocks.issuePartial,
}));
vi.mock('@/server/auth/audit', () => ({ recordSecurityAuditEvent: mocks.audit }));
vi.mock('@/lib/two-factor/crypto', () => ({
  getTwoFactorConfigurationError: () => ({
    code: 'two-factor-error-not-configured',
    message: 'TWO_FACTOR_ENCRYPTION_KEY is missing or invalid',
  }),
  isTwoFactorConfigured: mocks.isConfigured,
}));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseRequest.mockResolvedValue({
    body: { username: 'alice', password: 'secret' },
    error: undefined,
  });
  mocks.getKey.mockReturnValue('rate-key');
  mocks.checkLimit.mockResolvedValue({ allowed: true });
  mocks.recordFailure.mockResolvedValue(null);
  mocks.getUserByUsername.mockResolvedValue({
    id: 'user-1',
    username: 'alice',
    password: 'hashed-password',
    sessionVersion: 4,
    twoFactorRequired: false,
    role: 'admin',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  });
  mocks.checkPassword.mockReturnValue(true);
  mocks.getPolicy.mockResolvedValue({ required: false, requiredReason: null, enabled: false });
  mocks.isConfigured.mockReturnValue(true);
  mocks.issueAuth.mockReturnValue('full-token');
  mocks.issuePartial.mockReturnValue('partial-token');
  mocks.getAllUserTeams.mockResolvedValue([]);
});

test('issues only a partial token when enabled 2FA still needs verification', async () => {
  mocks.getPolicy.mockResolvedValue({ required: true, requiredReason: 'global', enabled: true });

  const response = await POST(new Request('http://localhost/api/auth/login', { method: 'POST' }));

  await expect(response.json()).resolves.toEqual({
    requiresTwoFactor: true,
    partialToken: 'partial-token',
  });
  expect(mocks.issuePartial).toHaveBeenCalled();
  expect(mocks.issueAuth).not.toHaveBeenCalled();
});

test('issues a setup-only token when required 2FA is not enabled yet', async () => {
  mocks.getPolicy.mockResolvedValue({ required: true, requiredReason: 'team', enabled: false });

  const response = await POST(new Request('http://localhost/api/auth/login', { method: 'POST' }));
  const body = await response.json();

  expect(body).toMatchObject({ token: 'full-token', requiresTwoFactorSetup: true });
  expect(mocks.issueAuth).toHaveBeenCalledWith(expect.any(Object), 1, { setupOnly: true });
});

test('fails closed when required 2FA cannot be configured', async () => {
  mocks.getPolicy.mockResolvedValue({ required: true, requiredReason: 'user', enabled: false });
  mocks.isConfigured.mockReturnValue(false);

  const response = await POST(new Request('http://localhost/api/auth/login', { method: 'POST' }));

  expect(response.status).toBe(503);
  expect(mocks.issueAuth).not.toHaveBeenCalled();
});

test('returns a deterministic safe 429 without checking credentials when already locked', async () => {
  mocks.checkLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 120 });

  const response = await POST(new Request('http://localhost/api/auth/login', { method: 'POST' }));

  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('120');
  await expect(response.json()).resolves.toMatchObject({
    error: { code: 'login-rate-limited', retryAfterSeconds: 120 },
  });
  expect(mocks.getUserByUsername).not.toHaveBeenCalled();
  expect(mocks.audit).toHaveBeenCalledWith({
    eventType: 'auth.login',
    outcome: 'blocked',
    metadata: { reason: 'rate_limited' },
  });
});

test('uses the same credential error for unknown users', async () => {
  mocks.getUserByUsername.mockResolvedValue(null);

  const response = await POST(new Request('http://localhost/api/auth/login', { method: 'POST' }));

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: 'incorrect-username-password' },
  });
});
