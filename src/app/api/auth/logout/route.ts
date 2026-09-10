import prisma from '@/lib/prisma';
import { parseRequest } from '@/lib/request';
import { ok } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';

export async function POST(request: Request) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
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
