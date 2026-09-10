import { z } from 'zod';
import { ROLES } from '@/lib/constants';
import { checkPassword } from '@/lib/password';
import { parseRequest } from '@/lib/request';
import { json, serviceUnavailable, unauthorized } from '@/lib/response';
import { getTwoFactorConfigurationError, isTwoFactorConfigured } from '@/lib/two-factor/crypto';
import { getAllUserTeams, getUserByUsername } from '@/queries/prisma';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import {
  checkLoginRateLimit,
  getLoginRateLimitKey,
  recordLoginFailure,
  resetLoginRateLimit,
} from '@/server/auth/login-rate-limit';
import { issueAuthToken, issuePartialAuthToken } from '@/server/auth/tokens';
import { getTwoFactorPolicy } from '@/server/auth/two-factor-policy';

function rateLimited(retryAfterSeconds: number) {
  return Response.json(
    {
      error: {
        message: 'Too many login attempts. Try again later.',
        code: 'login-rate-limited',
        status: 429,
        retryAfterSeconds,
      },
    },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}

export async function POST(request: Request) {
  const schema = z.object({
    username: z.string(),
    password: z.string(),
  });

  const { body, error } = await parseRequest(request, schema, { skipAuth: true });

  if (error) {
    return error();
  }

  const { username, password } = body;
  const rateLimitKey = getLoginRateLimitKey(request, username);
  const rateCheck = await checkLoginRateLimit(rateLimitKey);

  if (!rateCheck.allowed) {
    await recordSecurityAuditEvent({
      eventType: 'auth.login',
      outcome: 'blocked',
      metadata: { reason: 'rate_limited' },
    });
    return rateLimited(rateCheck.retryAfterSeconds);
  }

  const user = await getUserByUsername(username, {
    includePassword: true,
    includeSessionVersion: true,
  });

  if (!user || !checkPassword(password, user.password)) {
    const lockedUntil = await recordLoginFailure(rateLimitKey);
    await recordSecurityAuditEvent({
      actorUserId: user?.id,
      eventType: 'auth.login',
      outcome: lockedUntil ? 'blocked' : 'failure',
      metadata: { reason: lockedUntil ? 'rate_limited' : 'invalid_credentials' },
    });

    if (lockedUntil) {
      return rateLimited(Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)));
    }

    return unauthorized({ code: 'incorrect-username-password' });
  }

  await resetLoginRateLimit(rateLimitKey);

  const { id, role, createdAt } = user;
  const twoFactor = await getTwoFactorPolicy(id, user.twoFactorRequired);

  if ((twoFactor.enabled || twoFactor.required) && !isTwoFactorConfigured()) {
    await recordSecurityAuditEvent({
      actorUserId: id,
      eventType: 'auth.login',
      outcome: 'blocked',
      metadata: { reason: 'two_factor_not_configured' },
    });
    return serviceUnavailable(getTwoFactorConfigurationError());
  }

  if (twoFactor.enabled) {
    if (!isTwoFactorConfigured()) {
      return serviceUnavailable(getTwoFactorConfigurationError());
    }

    const partialToken = issuePartialAuthToken(user);
    await recordSecurityAuditEvent({
      actorUserId: id,
      eventType: 'auth.login',
      outcome: 'success',
      metadata: { assurance: 'pending_two_factor' },
    });
    return json({ requiresTwoFactor: true, partialToken });
  }

  const setupOnly = twoFactor.required;
  const token = issueAuthToken(user, 1, { setupOnly });

  const teams = await getAllUserTeams(id);

  await recordSecurityAuditEvent({
    actorUserId: id,
    eventType: 'auth.login',
    outcome: 'success',
    metadata: { assurance: setupOnly ? 'setup_only' : 'single_factor' },
  });

  return json({
    token,
    requiresTwoFactorSetup: setupOnly,
    user: { id, username, role, createdAt, isAdmin: role === ROLES.admin, teams },
  });
}
