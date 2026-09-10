import { Prisma } from '@/generated/prisma/client';
import { hash } from '@/lib/crypto';
import { getIpAddress } from '@/lib/ip';
import prisma from '@/lib/prisma';

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_SECONDS = 15 * 60;
const MAX_RETRIES = 3;
const DEFAULT_RETENTION_SECONDS = 24 * 60 * 60;

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function getLoginRateLimitConfig() {
  return {
    maxAttempts: positiveInteger('LOGIN_RATE_LIMIT_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS),
    windowSeconds: positiveInteger('LOGIN_RATE_LIMIT_WINDOW_SECONDS', DEFAULT_WINDOW_SECONDS),
  };
}

export function getLoginRateLimitKey(request: Request, username: string) {
  const client = getIpAddress(request.headers) || 'direct';
  return hash('login', username.trim().toLowerCase(), client);
}

export async function checkLoginRateLimit(key: string, now = new Date()) {
  const record = await prisma.client.loginRateLimit.findUnique({ where: { key } });

  if (record?.lockedUntil && record.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((record.lockedUntil.getTime() - now.getTime()) / 1000),
      ),
    };
  }

  return { allowed: true };
}

export async function recordLoginFailure(key: string, now = new Date()) {
  const { maxAttempts, windowSeconds } = getLoginRateLimitConfig();
  const windowMs = windowSeconds * 1000;

  await cleanupExpiredLoginRateLimits(now);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await (prisma.transaction(
        async (tx: Prisma.TransactionClient) => {
          const current = await tx.loginRateLimit.findUnique({ where: { key } });

          if (current?.lockedUntil && current.lockedUntil > now) {
            return current.lockedUntil;
          }

          const expiredWindow =
            !current || now.getTime() - current.windowStartedAt.getTime() >= windowMs;
          const attempts = expiredWindow ? 1 : current.attempts + 1;
          const lockedUntil = attempts >= maxAttempts ? new Date(now.getTime() + windowMs) : null;

          await tx.loginRateLimit.upsert({
            where: { key },
            create: {
              key,
              attempts,
              windowStartedAt: now,
              lockedUntil,
            },
            update: {
              attempts,
              windowStartedAt: expiredWindow ? now : current.windowStartedAt,
              lockedUntil,
            },
          });

          return lockedUntil;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ) as unknown as Promise<Date | null>);
    } catch (error: any) {
      if (error?.code !== 'P2034' || attempt === MAX_RETRIES - 1) {
        throw error;
      }
    }
  }

  return null;
}

export async function resetLoginRateLimit(key: string) {
  await prisma.client.loginRateLimit.deleteMany({ where: { key } });
}

export async function cleanupExpiredLoginRateLimits(now = new Date()) {
  const { windowSeconds } = getLoginRateLimitConfig();
  const retentionSeconds = Math.max(
    windowSeconds * 2,
    positiveInteger('LOGIN_RATE_LIMIT_RETENTION_SECONDS', DEFAULT_RETENTION_SECONDS),
  );
  const cutoff = new Date(now.getTime() - retentionSeconds * 1000);

  try {
    await prisma.client.loginRateLimit.deleteMany({
      where: { updatedAt: { lt: cutoff } },
    });
  } catch {
    // Cleanup is best effort; availability of the login decision is primary.
  }
}
