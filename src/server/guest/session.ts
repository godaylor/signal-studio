import { createHash } from 'node:crypto';
import type { GuestSession } from '@/generated/prisma/client';
import { GUEST_COOKIE, GUEST_LIMITS } from './contracts';
import { GUEST_DATASET, guestExampleQuery } from './dataset';
import { getGuestDatabase } from './database';

export function guestTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function guestCookieToken(request: Request) {
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .map(item => item.trim())
    .find(item => item.startsWith(`${GUEST_COOKIE}=`))
    ?.slice(GUEST_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export async function resolveGuestSession(request: Request, now = new Date()) {
  const token = guestCookieToken(request);
  if (!token) return null;
  const db = getGuestDatabase();
  const session = await db.guestSession.findUnique({ where: { tokenHash: guestTokenHash(token) } });
  if (!session || session.expiresAt <= now) return null;
  const user = await db.user.findFirst({
    where: { id: session.userId, deletedAt: null },
    select: { id: true, username: true, role: true, displayName: true, createdAt: true },
  });
  if (user?.role !== 'guest') return null;
  return { session, user: { ...user, isAdmin: false, isGuest: true } };
}

export function guestSessionInfo(session: GuestSession) {
  return {
    id: session.id,
    projectId: session.projectId,
    workspaceId: session.workspaceId,
    expiresAt: session.expiresAt.toISOString(),
    dataset: {
      ...GUEST_DATASET,
      startAt: session.datasetStartAt.toISOString(),
      endAt: session.datasetEndAt.toISOString(),
    },
    defaultQuery: guestExampleQuery(
      session.projectId,
      session.datasetStartAt,
      session.datasetEndAt,
    ),
    limits: GUEST_LIMITS,
  };
}

export function guestCookie(
  token: string,
  request: Request,
  maxAge = GUEST_LIMITS.lifetimeSeconds,
) {
  const secure = new URL(request.url).protocol === 'https:';
  return `${GUEST_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
