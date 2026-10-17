import { randomUUID } from 'node:crypto';
import {
  GUEST_COOKIE,
  GuestError,
  guestErrorResponse,
  sameOriginGuestRequest,
} from '@/server/guest/contracts';
import { startGuestSession } from '@/server/guest/service';
import { guestCookie, guestSessionInfo, resolveGuestSession } from '@/server/guest/session';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = randomUUID();
  try {
    const current = await resolveGuestSession(request);
    return Response.json(
      { guest: current ? guestSessionInfo(current.session) : null },
      { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
    );
  } catch (error) {
    return guestErrorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    if (!sameOriginGuestRequest(request)) throw new GuestError('guest-origin-denied', 403);
    const { token, ...result } = await startGuestSession(request);
    return Response.json(result, {
      headers: {
        'cache-control': 'no-store',
        'x-request-id': requestId,
        ...(token ? { 'set-cookie': guestCookie(token, request) } : {}),
      },
    });
  } catch (error) {
    return guestErrorResponse(error, requestId);
  }
}

export async function DELETE(request: Request) {
  const requestId = randomUUID();
  if (!sameOriginGuestRequest(request))
    return guestErrorResponse(new GuestError('guest-origin-denied', 403), requestId);
  const current = await resolveGuestSession(request);
  if (current) {
    const { default: prisma } = await import('@/lib/prisma');
    await prisma.client.guestSession.update({
      where: { id: current.session.id },
      data: { expiresAt: new Date() },
    });
  }
  return Response.json(
    { ok: true },
    {
      headers: {
        'cache-control': 'no-store',
        'set-cookie': `${GUEST_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      },
    },
  );
}
