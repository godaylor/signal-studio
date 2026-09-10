import { z } from 'zod';
import { checkPassword } from '@/lib/password';
import prisma from '@/lib/prisma';
import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, notFound, serviceUnavailable } from '@/lib/response';
import {
  decryptSecret,
  getTwoFactorConfigurationError,
  isTwoFactorConfigured,
} from '@/lib/two-factor/crypto';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/two-factor/rate-limit';
import { isOtpReplayed, markOtpUsed } from '@/lib/two-factor/replay-prevention';
import { verifyTotp } from '@/lib/two-factor/totp';
import { getUser } from '@/queries/prisma/user';
import { recordSecurityAuditEvent } from '@/server/auth/audit';

export async function POST(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const schema = z.object({
    password: z.string(),
    token: z.string().length(6),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (!isTwoFactorConfigured()) {
    await recordSecurityAuditEvent({
      actorUserId: auth.user.id,
      eventType: 'auth.two_factor.disable',
      outcome: 'blocked',
      metadata: { reason: 'two_factor_not_configured' },
    });
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  const userId = auth.user.id;
  const { password, token } = body;

  // Globally required
  const globalSetting = await prisma.client.appSetting.findUnique({
    where: { key: 'twoFactorRequiredGlobal' },
  });
  const isGlobalRequired = globalSetting?.value === 'true';

  // Required for this user
  const userRecord = await prisma.client.user.findUnique({
    where: { id: userId },
    select: { twoFactorRequired: true },
  });
  const isUserRequired = userRecord?.twoFactorRequired ?? false;

  // Required for this user's teams
  const userTeams = await prisma.client.teamUser.findMany({ where: { userId } });
  const teamIds = userTeams.map(t => t.teamId);
  const teamsWithRequirement = teamIds.length
    ? await prisma.client.team.findMany({
        where: { id: { in: teamIds }, twoFactorRequired: true },
      })
    : [];
  const isTeamRequired = teamsWithRequirement.length > 0;

  // Cannot disable 2FA if required
  if (isGlobalRequired || isUserRequired || isTeamRequired) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.disable',
      outcome: 'blocked',
      metadata: { reason: 'two_factor_required' },
    });
    return forbidden({
      code: 'two-factor-error-disable-not-allowed',
      message: '2FA is required and cannot be disabled',
    });
  }

  // Verify password
  const userWithPw = await getUser(userId, { includePassword: true });
  if (!userWithPw || !checkPassword(password, userWithPw.password)) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.disable',
      outcome: 'failure',
      metadata: { reason: 'incorrect_password' },
    });
    return badRequest({
      code: 'two-factor-error-incorrect-password',
      message: 'Incorrect password',
    });
  }

  // Verify if 2FA is enabled
  const twoFactor = await prisma.client.twoFactorAuth.findUnique({ where: { userId } });
  if (!twoFactor?.isEnabled) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.disable',
      outcome: 'failure',
      metadata: { reason: 'not_enabled' },
    });
    return badRequest({ code: 'two-factor-error-not-enabled', message: '2FA is not enabled' });
  }

  // Verify rate limit
  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.disable',
      outcome: 'blocked',
      metadata: { reason: 'rate_limited' },
    });
    return Response.json(
      {
        error: {
          code: 'two-factor-error-too-many-attempts',
          message: 'Too many failed attempts',
          lockedUntil: rateCheck.lockedUntil,
        },
      },
      { status: 429 },
    );
  }

  // Prevent OTP replay
  if (await isOtpReplayed(userId, token)) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.disable',
      outcome: 'failure',
      metadata: { reason: 'otp_replayed' },
    });
    return badRequest({ code: 'two-factor-error-code-used', message: 'Code already used' });
  }

  // Verify TOTP
  const secret = decryptSecret(twoFactor.secret);
  if (!(await verifyTotp(token, secret))) {
    const { lockedUntil } = await recordFailedAttempt(userId);
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.disable',
      outcome: lockedUntil ? 'blocked' : 'failure',
      metadata: { reason: 'invalid_otp' },
    });
    return badRequest({
      code: 'two-factor-error-invalid-code',
      message: 'Invalid verification code',
      ...(lockedUntil && { lockedUntil }),
    });
  }

  await prisma.transaction(async tx => {
    await markOtpUsed(userId, token, tx);
    await tx.twoFactorAuth.delete({ where: { userId } });
    await tx.twoFactorBackupCode.deleteMany({ where: { userId } });
  });
  await resetRateLimit(userId);

  await recordSecurityAuditEvent({
    actorUserId: userId,
    eventType: 'auth.two_factor.disable',
    outcome: 'success',
  });

  return json({ ok: true });
}
