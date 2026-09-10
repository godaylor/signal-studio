import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { anyObjectParam, filterParams, pagingParams } from '@/lib/schema';
import { canUpdateWebsite, canViewAuthenticatedWebsite } from '@/permissions';
import { getSharesByEntityId } from '@/queries/prisma';
import { legacyShareCreationDisabled } from '@/server/shares/legacy';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    ...filterParams,
    ...pagingParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { websiteId } = await params;
  const { page, pageSize, search } = query;

  if (!(await canViewAuthenticatedWebsite(auth, websiteId))) {
    return unauthorized();
  }

  const data = await getSharesByEntityId(websiteId, {
    page,
    pageSize,
    search,
  });

  return json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    name: z.string().max(200),
    parameters: anyObjectParam.optional(),
  });

  const { auth, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) {
    return unauthorized();
  }

  return legacyShareCreationDisabled();
}
