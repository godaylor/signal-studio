import z from 'zod';
import { parseRequest } from '@/lib/request';
import { unauthorized } from '@/lib/response';
import { anyObjectParam } from '@/lib/schema';
import { canUpdateEntity } from '@/permissions';
import { legacyShareCreationDisabled } from '@/server/shares/legacy';

export async function POST(request: Request) {
  const schema = z.object({
    entityId: z.uuid(),
    shareType: z.coerce.number().int(),
    name: z.string().max(200),
    slug: z.string().max(100).optional(),
    parameters: anyObjectParam,
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { entityId } = body;

  if (!(await canUpdateEntity(auth, entityId))) {
    return unauthorized();
  }

  return legacyShareCreationDisabled();
}
