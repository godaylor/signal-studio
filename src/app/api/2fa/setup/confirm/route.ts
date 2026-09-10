import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseRequest } from '@/lib/request';
import { badRequest, json, notFound, serviceUnavailable } from '@/lib/response';
import { generateBackupCodes } from '@/lib/two-factor/backup-codes';
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
import { issueAuthToken } from '@/server/auth/tokens';

export async function POST(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const schema = z.object({ token: z.string().length(6) });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (!isTwoFactorConfigured()) {
    await recordSecurityAuditEvent({
      actorUserId: auth.user.id,
      eventType: 'auth.two_factor.setup',
      outcome: 'blocked',
      metadata: { reason: 'two_factor_not_configured' },
    });
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  const userId = auth.user.id;
  const { token } = body;

  const twoFactor = await prisma.client.twoFactorAuth.findUnique({ where: { userId } });

  // Verify if 2FA is waiting for setup
  if (!twoFactor || twoFactor.isEnabled) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.setup',
      outcome: 'failure',
      metadata: { reason: 'no_pending_setup' },
    });
    return badRequest({
      code: 'two-factor-error-no-pending-setup',
      message: 'No pending 2FA setup found',
    });
  }

  // Verify rate limit
  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.setup',
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
      eventType: 'auth.two_factor.setup',
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
      eventType: 'auth.two_factor.setup',
      outcome: lockedUntil ? 'blocked' : 'failure',
      metadata: { reason: 'invalid_otp' },
    });
    return badRequest({
      code: 'two-factor-error-invalid-code',
      message: 'Invalid verification code',
      ...(lockedUntil && { lockedUntil }),
    });
  }

  const { plaintext, hashed } = await generateBackupCodes();

  await prisma.transaction(async tx => {
    await tx.twoFactorAuth.update({ where: { userId }, data: { isEnabled: true } });
    await tx.twoFactorBackupCode.deleteMany({ where: { userId } });
    await tx.twoFactorBackupCode.createMany({
      data: hashed.map(codeHash => ({ userId, codeHash })),
    });
    await markOtpUsed(userId, token, tx);
    await tx.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
  });

  await resetRateLimit(userId);

  const user = await getUser(userId, { includePassword: true, includeSessionVersion: true });

  if (!user) {
    return badRequest({ message: 'User not found' });
  }

  const authToken = issueAuthToken(user, 2);
  await recordSecurityAuditEvent({
    actorUserId: userId,
    eventType: 'auth.two_factor.setup',
    outcome: 'success',
  });

  return json({ backupCodes: plaintext, token: authToken });
}
