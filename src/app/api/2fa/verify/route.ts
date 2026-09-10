import { z } from 'zod';
import { getBearerToken } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import prisma from '@/lib/prisma';
import { parseRequest } from '@/lib/request';
import { badRequest, json, notFound, serviceUnavailable, unauthorized } from '@/lib/response';
import { verifyBackupCode } from '@/lib/two-factor/backup-codes';
import {
  decryptSecret,
  getTwoFactorConfigurationError,
  isTwoFactorConfigured,
} from '@/lib/two-factor/crypto';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/two-factor/rate-limit';
import { isOtpReplayed, markOtpUsed } from '@/lib/two-factor/replay-prevention';
import { verifyTotp } from '@/lib/two-factor/totp';
import { getAllUserTeams, getUser } from '@/queries/prisma';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { issueAuthToken, parsePartialAuthToken, tokenMatchesUser } from '@/server/auth/tokens';

export async function POST(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const schema = z.union([
    z.object({ token: z.string().length(6) }).strict(),
    z.object({ backupCode: z.string().min(1) }).strict(),
  ]);

  const rawToken = getBearerToken(request);
  if (!rawToken) {
    await recordSecurityAuditEvent({
      eventType: 'auth.two_factor.verify',
      outcome: 'failure',
      metadata: { reason: 'missing_partial_token' },
    });
    return unauthorized({ code: 'two-factor-error-missing-token' });
  }

  const payload = parsePartialAuthToken(rawToken);
  if (!payload) {
    await recordSecurityAuditEvent({
      eventType: 'auth.two_factor.verify',
      outcome: 'failure',
      metadata: { reason: 'invalid_partial_token' },
    });
    return unauthorized({ code: 'two-factor-error-invalid-partial-token' });
  }

  if (!isTwoFactorConfigured()) {
    await recordSecurityAuditEvent({
      actorUserId: payload.userId,
      eventType: 'auth.two_factor.verify',
      outcome: 'blocked',
      metadata: { reason: 'two_factor_not_configured' },
    });
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  const { body, error } = await parseRequest(request, schema, { skipAuth: true });
  if (error) {
    return error();
  }

  const userId = payload.userId as string;
  const user = await getUser(userId, { includePassword: true, includeSessionVersion: true });

  if (!user || !tokenMatchesUser(payload, user)) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.verify',
      outcome: 'failure',
      metadata: { reason: 'revoked_partial_token' },
    });
    return unauthorized();
  }

  const twoFactor = await prisma.client.twoFactorAuth.findUnique({ where: { userId } });

  if (!twoFactor?.isEnabled) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.verify',
      outcome: 'failure',
      metadata: { reason: 'two_factor_not_enabled' },
    });
    return badRequest({
      code: 'two-factor-error-not-enabled',
      message: '2FA not enabled for this user',
    });
  }

  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.two_factor.verify',
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

  if (body.backupCode) {
    const unusedCodes = await prisma.client.twoFactorBackupCode.findMany({
      where: { userId, used: false },
    });
    const hashes = unusedCodes.map(c => c.codeHash);
    const matchIndex = await verifyBackupCode(body.backupCode, hashes);

    if (matchIndex === null) {
      const { lockedUntil } = await recordFailedAttempt(userId);
      await recordSecurityAuditEvent({
        actorUserId: userId,
        eventType: 'auth.two_factor.verify',
        outcome: lockedUntil ? 'blocked' : 'failure',
        metadata: { reason: 'invalid_backup_code' },
      });
      return badRequest({
        code: 'two-factor-error-invalid-backup-code',
        message: 'Invalid backup code',
        ...(lockedUntil && { lockedUntil }),
      });
    }

    const consumed = await prisma.client.twoFactorBackupCode.updateMany({
      where: { id: unusedCodes[matchIndex].id, used: false },
      data: { used: true },
    });

    if (consumed.count === 0) {
      const { lockedUntil } = await recordFailedAttempt(userId);
      await recordSecurityAuditEvent({
        actorUserId: userId,
        eventType: 'auth.two_factor.verify',
        outcome: lockedUntil ? 'blocked' : 'failure',
        metadata: { reason: 'backup_code_already_used' },
      });
      return badRequest({
        code: 'two-factor-error-invalid-backup-code',
        message: 'Invalid backup code',
        ...(lockedUntil && { lockedUntil }),
      });
    }

    await resetRateLimit(userId);
  } else {
    const { token } = body;

    if (await isOtpReplayed(userId, token)) {
      await recordSecurityAuditEvent({
        actorUserId: userId,
        eventType: 'auth.two_factor.verify',
        outcome: 'failure',
        metadata: { reason: 'otp_replayed' },
      });
      return badRequest({ code: 'two-factor-error-code-used', message: 'Code already used' });
    }

    const decryptedSecret = decryptSecret(twoFactor.secret);

    if (!(await verifyTotp(token, decryptedSecret))) {
      const { lockedUntil } = await recordFailedAttempt(userId);
      await recordSecurityAuditEvent({
        actorUserId: userId,
        eventType: 'auth.two_factor.verify',
        outcome: lockedUntil ? 'blocked' : 'failure',
        metadata: { reason: 'invalid_otp' },
      });
      return badRequest({
        code: 'two-factor-error-invalid-code',
        message: 'Invalid verification code',
        ...(lockedUntil && { lockedUntil }),
      });
    }

    await markOtpUsed(userId, token);
    await resetRateLimit(userId);
  }

  const { id, role, createdAt, username } = user;

  const fullToken = issueAuthToken(user, 2);

  const teams = await getAllUserTeams(id);

  await recordSecurityAuditEvent({
    actorUserId: id,
    eventType: 'auth.two_factor.verify',
    outcome: 'success',
  });

  return json({
    token: fullToken,
    user: { id, username, role, createdAt, isAdmin: role === ROLES.admin, teams },
  });
}
