import { randomUUID } from 'node:crypto';
import type { Insight, Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { AnalysisQueryV1 } from '@/server/analytics/contracts';
import { normalizeAnalysisQuery } from '@/server/analytics/normalize';
import { canMutateInsight, type InsightAccess } from '@/server/permissions/insights';

export const INSIGHT_PAGE_LIMIT = 30;
export const INSIGHT_STATUSES = ['active', 'archived'] as const;
export type InsightStatus = (typeof INSIGHT_STATUSES)[number];

export class InsightNotFoundError extends Error {}
export class InsightForbiddenError extends Error {}
export class InvalidInsightCursorError extends Error {}

interface InsightRecord extends Insight {
  owner: { id: string; username: string };
  _count?: { dashboardWidgets: number };
}

export interface InsightDto {
  id: string;
  projectId: string;
  owner: { id: string; username: string };
  title: string;
  description: string;
  queryVersion: number;
  query: AnalysisQueryV1 | null;
  visualization: Record<string, unknown>;
  status: InsightStatus;
  favorite: boolean;
  compatibility: { state: 'ready' | 'unsupported'; message?: string };
  dependencies: { dashboards: number };
  createdAt: string;
  updatedAt: string;
}

type Cursor = { updatedAt: string; id: string };

export function encodeInsightCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeInsightCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (!parsed.id || Number.isNaN(new Date(parsed.updatedAt).getTime())) throw new Error();
    return parsed;
  } catch {
    throw new InvalidInsightCursorError('Insight cursor is invalid or expired.');
  }
}

function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function toInsightDto(
  record: InsightRecord,
  dashboardCount = record._count?.dashboardWidgets ?? 0,
): InsightDto {
  let query: AnalysisQueryV1 | null = null;
  let compatibility: InsightDto['compatibility'];

  if (record.queryVersion !== 1) {
    compatibility = {
      state: 'unsupported',
      message: `AnalysisQuery v${record.queryVersion} is not supported by this workspace.`,
    };
  } else {
    try {
      query = normalizeAnalysisQuery(record.query);
      compatibility = { state: 'ready' };
    } catch {
      compatibility = {
        state: 'unsupported',
        message: 'The saved query is invalid and was not migrated implicitly.',
      };
    }
  }

  return {
    id: record.id,
    projectId: record.projectId,
    owner: record.owner,
    title: record.title,
    description: record.description,
    queryVersion: record.queryVersion,
    query,
    visualization: jsonObject(record.visualization),
    status: record.status as InsightStatus,
    favorite: record.favorite,
    compatibility,
    dependencies: { dashboards: dashboardCount },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

const insightInclude = {
  owner: { select: { id: true, username: true } },
  _count: { select: { dashboardWidgets: true } },
} as const;

export async function listInsights({
  access,
  search,
  ownerId,
  status = 'active',
  favorite,
  cursor,
  limit = INSIGHT_PAGE_LIMIT,
}: {
  access: InsightAccess;
  search?: string;
  ownerId?: string;
  status?: InsightStatus;
  favorite?: boolean;
  cursor?: string;
  limit?: number;
}) {
  const decoded = cursor ? decodeInsightCursor(cursor) : undefined;
  const where: Prisma.InsightWhereInput = {
    projectId: access.projectId,
    status,
    ...(ownerId ? { ownerId } : {}),
    ...(favorite !== undefined ? { favorite } : {}),
    AND: [
      ...(search
        ? [
            {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          ]
        : []),
      ...(decoded
        ? [
            {
              OR: [
                { updatedAt: { lt: new Date(decoded.updatedAt) } },
                { updatedAt: new Date(decoded.updatedAt), id: { lt: decoded.id } },
              ],
            },
          ]
        : []),
    ],
  };

  const records = await prisma.client.insight.findMany({
    where,
    include: insightInclude,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: Math.min(limit, INSIGHT_PAGE_LIMIT) + 1,
  });
  const hasMore = records.length > Math.min(limit, INSIGHT_PAGE_LIMIT);
  const page = hasMore ? records.slice(0, -1) : records;
  const last = page.at(-1);

  return {
    data: page.map(record => toInsightDto(record)),
    nextCursor:
      hasMore && last
        ? encodeInsightCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
        : null,
  };
}

export async function getInsight(access: InsightAccess, insightId: string) {
  const record = await prisma.client.insight.findFirst({
    where: { id: insightId, projectId: access.projectId },
    include: insightInclude,
  });
  if (!record) throw new InsightNotFoundError('Insight was not found.');
  return toInsightDto(record);
}

export async function createInsight({
  access,
  title,
  description = '',
  query: input,
  visualization = {},
  favorite = false,
}: {
  access: InsightAccess;
  title: string;
  description?: string;
  query: unknown;
  visualization?: Record<string, unknown>;
  favorite?: boolean;
}) {
  if (!access.canCreate) throw new InsightForbiddenError('This role cannot create Insights.');
  const query = normalizeAnalysisQuery(input);
  if (query.projectId !== access.projectId)
    throw new InsightForbiddenError('Query project mismatch.');

  const record = await prisma.client.insight.create({
    data: {
      id: randomUUID(),
      projectId: access.projectId,
      ownerId: access.actorUserId,
      title,
      description,
      queryVersion: query.version,
      query: query as Prisma.InputJsonValue,
      visualization: { ...visualization, type: query.visualization } as Prisma.InputJsonValue,
      favorite,
    },
    include: insightInclude,
  });
  return toInsightDto(record);
}

export async function updateInsight({
  access,
  insightId,
  title,
  description,
  query: input,
  visualization,
  favorite,
  status,
}: {
  access: InsightAccess;
  insightId: string;
  title?: string;
  description?: string;
  query?: unknown;
  visualization?: Record<string, unknown>;
  favorite?: boolean;
  status?: InsightStatus;
}) {
  const existing = await prisma.client.insight.findFirst({
    where: { id: insightId, projectId: access.projectId },
    select: { ownerId: true },
  });
  if (!existing) throw new InsightNotFoundError('Insight was not found.');
  if (!canMutateInsight(access, existing.ownerId)) {
    throw new InsightForbiddenError('This role cannot edit this Insight.');
  }

  const query = input === undefined ? undefined : normalizeAnalysisQuery(input);
  if (query && query.projectId !== access.projectId) {
    throw new InsightForbiddenError('Query project mismatch.');
  }
  const record = await prisma.client.insight.update({
    where: { id: insightId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(favorite !== undefined ? { favorite } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(query
        ? {
            queryVersion: query.version,
            query: query as Prisma.InputJsonValue,
            visualization: {
              ...(visualization ?? {}),
              type: query.visualization,
            } as Prisma.InputJsonValue,
          }
        : visualization
          ? { visualization: visualization as Prisma.InputJsonValue }
          : {}),
    },
    include: insightInclude,
  });
  return toInsightDto(record);
}

export async function duplicateInsight(access: InsightAccess, insightId: string) {
  if (!access.canCreate) throw new InsightForbiddenError('This role cannot duplicate Insights.');
  const source = await prisma.client.insight.findFirst({
    where: { id: insightId, projectId: access.projectId },
    include: insightInclude,
  });
  if (!source) throw new InsightNotFoundError('Insight was not found.');

  const query = normalizeAnalysisQuery(structuredClone(source.query));
  const record = await prisma.client.insight.create({
    data: {
      id: randomUUID(),
      projectId: source.projectId,
      ownerId: access.actorUserId,
      title: `Copy of ${source.title}`.slice(0, 200),
      description: source.description,
      queryVersion: query.version,
      query: structuredClone(query) as Prisma.InputJsonValue,
      visualization: structuredClone(source.visualization) as Prisma.InputJsonValue,
      favorite: false,
      status: 'active',
    },
    include: insightInclude,
  });
  return toInsightDto(record);
}
