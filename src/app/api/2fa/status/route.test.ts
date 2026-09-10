import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  getPolicy: vi.fn(),
  isConfigured: vi.fn(),
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/server/auth/two-factor-policy', () => ({ getTwoFactorPolicy: mocks.getPolicy }));
vi.mock('@/lib/two-factor/crypto', () => ({
  isTwoFactorConfigured: mocks.isConfigured,
}));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1', twoFactorRequired: false } },
    error: undefined,
  });
  mocks.getPolicy.mockResolvedValue({
    enabled: false,
    required: true,
    requiredReason: 'global',
  });
  mocks.isConfigured.mockReturnValue(true);
});

test('reports the same global requirement enforced by the common guard', async () => {
  const response = await GET(new Request('http://localhost/api/2fa/status'));

  await expect(response.json()).resolves.toEqual({
    isEnabled: false,
    isRequired: true,
    isConfigured: true,
    globalRequired: true,
    requiredReason: 'global',
  });
});

test('keeps the requirement visible when encryption is unavailable so login fails closed', async () => {
  mocks.isConfigured.mockReturnValue(false);

  const response = await GET(new Request('http://localhost/api/2fa/status'));

  await expect(response.json()).resolves.toEqual({
    isEnabled: false,
    isRequired: true,
    isConfigured: false,
    globalRequired: true,
    requiredReason: 'global',
  });
});
