import prisma from '@/lib/prisma';

export interface TwoFactorPolicy {
  required: boolean;
  requiredReason: 'global' | 'user' | 'team' | null;
  enabled: boolean;
}

export async function getTwoFactorPolicy(
  userId: string,
  userRequired?: boolean,
): Promise<TwoFactorPolicy> {
  if (process.env.CLOUD_MODE) {
    return { required: false, requiredReason: null, enabled: false };
  }

  const [twoFactor, globalSetting, user, requiredTeam] = await Promise.all([
    prisma.client.twoFactorAuth.findUnique({
      where: { userId },
      select: { isEnabled: true },
    }),
    prisma.client.appSetting.findUnique({
      where: { key: 'twoFactorRequiredGlobal' },
      select: { value: true },
    }),
    userRequired === undefined
      ? prisma.client.user.findUnique({
          where: { id: userId },
          select: { twoFactorRequired: true },
        })
      : Promise.resolve({ twoFactorRequired: userRequired }),
    prisma.client.teamUser.findFirst({
      where: { userId, team: { twoFactorRequired: true } },
      select: { id: true },
    }),
  ]);

  const globalRequired = globalSetting?.value === 'true';
  const individualRequired = user?.twoFactorRequired === true;
  const teamRequired = Boolean(requiredTeam);
  const requiredReason = globalRequired
    ? 'global'
    : individualRequired
      ? 'user'
      : teamRequired
        ? 'team'
        : null;

  return {
    required: requiredReason !== null,
    requiredReason,
    enabled: twoFactor?.isEnabled === true,
  };
}
