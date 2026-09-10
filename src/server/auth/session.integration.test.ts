import { beforeEach, expect, test, vi } from 'vitest';

const store = vi.hoisted(() => ({
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'alice',
    role: 'admin',
    password: 'bcrypt-hash',
    sessionVersion: 4,
    twoFactorRequired: true,
  },
  policy: { required: true, requiredReason: 'user', enabled: true },
}));

vi.mock('@/queries/prisma/user', () => ({
  getUser: vi.fn(async () => ({ ...store.user })),
}));
vi.mock('@/server/auth/two-factor-policy', () => ({
  getTwoFactorPolicy: vi.fn(async () => ({ ...store.policy })),
}));

import { checkAuth } from '@/lib/auth';
import { parseRequest } from '@/lib/request';
import { issueAuthToken, issuePartialAuthToken } from './tokens';

function request(path: string, token: string) {
  return new Request(`http://localhost${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  vi.stubEnv('APP_SECRET', 'integration-token-secret-at-least-32-characters');
  vi.stubEnv('NODE_ENV', 'test');
  store.user.sessionVersion = 4;
  store.policy.required = true;
  store.policy.enabled = true;
});

test('real setup, partial and full tokens enforce common protected-route assurance', async () => {
  const setupToken = issueAuthToken(store.user, 1, { setupOnly: true });
  const partialToken = issuePartialAuthToken(store.user);
  const fullToken = issueAuthToken(store.user, 2);

  const protectedBeforeAssurance = await parseRequest(request('/api/websites', setupToken));
  expect(protectedBeforeAssurance.error?.().status).toBe(403);

  const setupRoute = await parseRequest(request('/api/2fa/setup/initiate', setupToken));
  expect(setupRoute.error).toBeUndefined();

  expect(await checkAuth(request('/api/websites', partialToken))).toBeNull();

  const protectedAfterAssurance = await parseRequest(request('/api/websites', fullToken));
  expect(protectedAfterAssurance.error).toBeUndefined();
  expect(protectedAfterAssurance.auth.user.id).toBe(store.user.id);
});

test('real parser rejects expired and session-version-revoked full tokens', async () => {
  const expired = issueAuthToken(store.user, 2, { expiresIn: -1 });
  expect(await checkAuth(request('/api/websites', expired))).toBeNull();

  const current = issueAuthToken(store.user, 2);
  store.user.sessionVersion += 1;

  expect(await checkAuth(request('/api/websites', current))).toBeNull();
});
