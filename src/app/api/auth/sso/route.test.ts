import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/queries/prisma', () => ({ getUser: mocks.getUser }));

import { parseAuthSessionToken, tokenMatchesUser } from '@/server/auth/tokens';
import { POST } from './route';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'alice',
  role: 'admin',
  password: 'password-hash',
  sessionVersion: 3,
};

beforeEach(() => {
  vi.stubEnv('APP_SECRET', 'sso-route-test-secret-at-least-32-characters');
  vi.stubEnv('NODE_ENV', 'test');
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: user.id }, assuranceLevel: 2 },
    error: undefined,
  });
  mocks.getUser.mockResolvedValue(user);
});

test('SSO rotates to a canonical-TTL token accepted by the strict session parser', async () => {
  const response = await POST(new Request('http://localhost/api/auth/sso', { method: 'POST' }));
  const body = await response.json();
  const payload = parseAuthSessionToken(body.token);

  expect(response.status).toBe(200);
  expect(payload).not.toBeNull();
  expect(payload?.aal).toBe(2);
  expect(payload && tokenMatchesUser(payload, user)).toBe(true);
});
