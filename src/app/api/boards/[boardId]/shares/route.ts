import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { anyObjectParam, filterParams, pagingParams } from '@/lib/schema';
import { canUpdateBoard, canViewBoard } from '@/permissions';
import { getSharesByEntityId } from '@/queries/prisma';
import { legacyShareCreationDisabled } from '@/server/shares/legacy';

export async function GET(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const schema = z.object({
    ...filterParams,
    ...pagingParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { boardId } = await params;
  const { page, pageSize, search } = query;

  if (!(await canViewBoard(auth, boardId))) {
    return unauthorized();
  }

  const data = await getSharesByEntityId(boardId, {
    page,
    pageSize,
    search,
  });

  return json(data);
}

export async function POST(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const schema = z.object({
    name: z.string().max(200),
    parameters: anyObjectParam.optional(),
  });

  const { auth, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { boardId } = await params;
  if (!(await canUpdateBoard(auth, boardId))) {
    return unauthorized();
  }

  return legacyShareCreationDisabled();
}
