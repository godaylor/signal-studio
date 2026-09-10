import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findTwoFactor: vi.fn(),
  findSetting: vi.fn(),
  findUser: vi.fn(),
  findTeamUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      twoFactorAuth: { findUnique: mocks.findTwoFactor },
      appSetting: { findUnique: mocks.findSetting },
      user: { findUnique: mocks.findUser },
      teamUser: { findFirst: mocks.findTeamUser },
    },
  },
}));

import { getTwoFactorPolicy } from './two-factor-policy';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CLOUD_MODE;
  mocks.findTwoFactor.mockResolvedValue({ isEnabled: false });
  mocks.findSetting.mockResolvedValue(null);
  mocks.findUser.mockResolvedValue({ twoFactorRequired: false });
  mocks.findTeamUser.mockResolvedValue(null);
});

test('global requirement takes precedence and is enforced before setup', async () => {
  mocks.findSetting.mockResolvedValue({ value: 'true' });

  await expect(getTwoFactorPolicy('user-1')).resolves.toEqual({
    required: true,
    requiredReason: 'global',
    enabled: false,
  });
});

test('detects user and team requirements server-side', async () => {
  mocks.findUser.mockResolvedValue({ twoFactorRequired: true });
  await expect(getTwoFactorPolicy('user-1')).resolves.toMatchObject({
    required: true,
    requiredReason: 'user',
  });

  mocks.findUser.mockResolvedValue({ twoFactorRequired: false });
  mocks.findTeamUser.mockResolvedValue({ id: 'membership-1' });
  await expect(getTwoFactorPolicy('user-1')).resolves.toMatchObject({
    required: true,
    requiredReason: 'team',
  });
});
