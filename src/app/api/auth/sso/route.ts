import { parseRequest } from '@/lib/request';
import { json } from '@/lib/response';
import { getUser } from '@/queries/prisma';
import { issueAuthToken } from '@/server/auth/tokens';

export async function POST(request: Request) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const user = await getUser(auth.user.id, {
    includePassword: true,
    includeSessionVersion: true,
  });
  const token = issueAuthToken(user, auth.assuranceLevel === 2 ? 2 : 1);

  return json({ user: auth.user, token });
}
