import prisma from '@/lib/prisma';
import { parseRequest } from '@/lib/request';
import { json, notFound } from '@/lib/response';
import { recordSecurityAuditEvent } from '@/server/auth/audit';

export async function POST(request: Request) {
  if (process.env.CLOUD_MODE) {
    return notFound();
  }

  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const userId = auth.user.id;

  const result = await prisma.client.twoFactorAuth.deleteMany({
    where: { userId, isEnabled: false },
  });

  await recordSecurityAuditEvent({
    actorUserId: userId,
    eventType: 'auth.two_factor.setup.cancel',
    outcome: 'success',
    metadata: { pendingSetupRemoved: result.count > 0 },
  });

  return json({ ok: true });
}
