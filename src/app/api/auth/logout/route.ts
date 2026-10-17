import prisma from '@/lib/prisma';
import { parseRequest } from '@/lib/request';
import { ok } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';
import { guestCookie } from '@/server/guest/session';

export async function POST(request: Request) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  if (auth.guest) {
    await prisma.client.guestSession.update({ where: { id: auth.guest.id }, data: { expiresAt: new Date() } });
    return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store', 'set-cookie': guestCookie('', request, 0) } });
  }

  await prisma.client.user.update({
    where: { id: auth.user.id },
    data: { sessionVersion: { increment: 1 } },
  });
  await recordSecurityAuditEvent({
    actorUserId: auth.user.id,
    eventType: 'auth.logout',
    outcome: 'success',
  });

  return ok();
}
