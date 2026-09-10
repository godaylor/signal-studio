import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { anyObjectParam, filterParams, pagingParams } from '@/lib/schema';
import { canUpdatePixel, canViewPixel } from '@/permissions';
import { getSharesByEntityId } from '@/queries/prisma';
import { legacyShareCreationDisabled } from '@/server/shares/legacy';

export async function GET(request: Request, { params }: { params: Promise<{ pixelId: string }> }) {
  const schema = z.object({
    ...filterParams,
    ...pagingParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { pixelId } = await params;
  const { page, pageSize, search } = query;

  if (!(await canViewPixel(auth, pixelId))) {
    return unauthorized();
  }

  const data = await getSharesByEntityId(pixelId, {
    page,
    pageSize,
    search,
  });

  return json(data);
}

export async function POST(request: Request, { params }: { params: Promise<{ pixelId: string }> }) {
  const schema = z.object({
    name: z.string().max(200),
    parameters: anyObjectParam.optional(),
  });

  const { auth, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { pixelId } = await params;
  if (!(await canUpdatePixel(auth, pixelId))) {
    return unauthorized();
  }

  return legacyShareCreationDisabled();
}
