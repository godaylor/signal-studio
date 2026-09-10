import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { anyObjectParam, filterParams, pagingParams } from '@/lib/schema';
import { canUpdateLink, canViewLink } from '@/permissions';
import { getSharesByEntityId } from '@/queries/prisma';
import { legacyShareCreationDisabled } from '@/server/shares/legacy';

export async function GET(request: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const schema = z.object({
    ...filterParams,
    ...pagingParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { linkId } = await params;
  const { page, pageSize, search } = query;

  if (!(await canViewLink(auth, linkId))) {
    return unauthorized();
  }

  const data = await getSharesByEntityId(linkId, {
    page,
    pageSize,
    search,
  });

  return json(data);
}

export async function POST(request: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const schema = z.object({
    name: z.string().max(200),
    parameters: anyObjectParam.optional(),
  });

  const { auth, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { linkId } = await params;
  if (!(await canUpdateLink(auth, linkId))) {
    return unauthorized();
  }

  return legacyShareCreationDisabled();
}
