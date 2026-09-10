import { z } from 'zod';
import { checkPassword, hashPassword } from '@/lib/password';
import { parseRequest } from '@/lib/request';
import { badRequest, json } from '@/lib/response';
import { getUser, updateUser } from '@/queries/prisma/user';
import { recordSecurityAuditEvent } from '@/server/auth/audit';

export async function POST(request: Request) {
  const schema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const userId = auth.user.id;
  const { currentPassword, newPassword } = body;

  const user = await getUser(userId, { includePassword: true });

  if (!checkPassword(currentPassword, user.password)) {
    await recordSecurityAuditEvent({
      actorUserId: userId,
      eventType: 'auth.password.change',
      outcome: 'failure',
      metadata: { reason: 'incorrect_current_password' },
    });
    return badRequest({ message: 'Current password is incorrect' });
  }

  const password = hashPassword(newPassword);

  const updated = await updateUser(userId, { password });

  await recordSecurityAuditEvent({
    actorUserId: userId,
    eventType: 'auth.password.change',
    outcome: 'success',
  });

  return json(updated);
}
