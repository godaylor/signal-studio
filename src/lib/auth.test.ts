import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getUser } from '@/queries/prisma/user';
import { AUTH_SETUP_TOKEN_TYPE, AUTH_TOKEN_TYPE } from '@/server/auth/constants';
import { parseAuthSessionToken, tokenMatchesUser } from '@/server/auth/tokens';
import { getTwoFactorPolicy } from '@/server/auth/two-factor-policy';
import { checkAuth } from './auth';
import jwt from 'jsonwebtoken';

vi.mock('@/lib/jwt', () => ({ parseToken: vi.fn(() => null) }));
vi.mock('@/queries/prisma/user', () => ({ getUser: vi.fn() }));
vi.mock('@/server/auth/tokens', () => ({
  parseAuthSessionToken: vi.fn(),
  tokenMatchesUser: vi.fn(),
}));
vi.mock('@/server/auth/two-factor-policy', () => ({ getTwoFactorPolicy: vi.fn() }));

const parseTokenMock = vi.mocked(parseAuthSessionToken);
const tokenMatchesUserMock = vi.mocked(tokenMatchesUser);
const getUserMock = vi.mocked(getUser);
const getPolicyMock = vi.mocked(getTwoFactorPolicy);

function authedRequest(path = '/api/test') {
  return new Request(`http://localhost${path}`, {
    headers: { authorization: 'Bearer secure-token' },
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    role: 'user',
    pwd: 'fingerprint',
    sv: 3,
    aal: 1,
    sid: 'session-1',
    type: AUTH_TOKEN_TYPE,
    aud: 'signal-studio-management',
    iat: 1,
    exp: 2,
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  parseTokenMock.mockReturnValue(payload());
  tokenMatchesUserMock.mockReturnValue(true);
  getUserMock.mockResolvedValue({
    id: 'user-1',
    username: 'bob',
    role: 'user',
    password: 'password-hash',
    sessionVersion: 3,
    twoFactorRequired: false,
  } as any);
  getPolicyMock.mockResolvedValue({ required: false, requiredReason: null, enabled: false });
});

describe('checkAuth session contract', () => {
  test('rejects previously signed legacy shares before any data lookup', async () => {
    parseTokenMock.mockReturnValue(null);
    const legacy = jwt.sign({ type: 'share', shareId: 'removed-share', websiteId: 'project-1' }, 'test-only-key');
    for (const context of ['website', 'board']) {
      const request = new Request('http://127.0.0.1:32169/api/websites/project-1/stats', {
        headers: { 'x-umami-share-token': legacy, 'x-umami-share-context': context },
      });
      expect(await checkAuth(request)).toBeNull();
    }
    expect(getUserMock).not.toHaveBeenCalled();
  });
  test('authorizes a current full management token', async () => {
    const result = await checkAuth(authedRequest());

    expect(result?.user?.id).toBe('user-1');
    expect(result?.sessionId).toBe('session-1');
    expect(result?.assuranceRequired).toBe(false);
  });

  test('rejects legacy or malformed tokens before a user lookup', async () => {
    parseTokenMock.mockReturnValue(null);

    const result = await checkAuth(authedRequest());

    expect(result).toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  test('rejects a token after password or session-version revocation', async () => {
    tokenMatchesUserMock.mockReturnValue(false);

    expect(await checkAuth(authedRequest())).toBeNull();
  });

  test('marks an AAL1 token restricted when 2FA becomes required', async () => {
    getPolicyMock.mockResolvedValue({ required: true, requiredReason: 'global', enabled: true });

    const result = await checkAuth(authedRequest());

    expect(result?.assuranceRequired).toBe(true);
  });

  test('accepts AAL2 when required 2FA is currently enabled', async () => {
    parseTokenMock.mockReturnValue(payload({ aal: 2 }));
    getPolicyMock.mockResolvedValue({ required: true, requiredReason: 'team', enabled: true });

    const result = await checkAuth(authedRequest());

    expect(result?.assuranceRequired).toBe(false);
  });

  test('always restricts setup-only tokens', async () => {
    parseTokenMock.mockReturnValue(payload({ type: AUTH_SETUP_TOKEN_TYPE }));

    const result = await checkAuth(authedRequest('/api/2fa/setup/initiate'));

    expect(result?.assuranceRequired).toBe(true);
  });

  test('does not expose password or session version', async () => {
    const result = await checkAuth(authedRequest());

    expect(result?.user).not.toHaveProperty('password');
    expect(result?.user).not.toHaveProperty('sessionVersion');
  });

  test('keeps guard overhead p95 below 25 ms in the deterministic mocked-store environment', async () => {
    const durations: number[] = [];

    for (let index = 0; index < 200; index++) {
      const startedAt = performance.now();
      await checkAuth(authedRequest());
      durations.push(performance.now() - startedAt);
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];

    expect(p95).toBeLessThan(25);
  });
});
