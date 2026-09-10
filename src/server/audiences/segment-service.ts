import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { InsightAccess } from '@/server/permissions/insights';
import { canViewSensitiveTraits } from '@/server/permissions/project-data';
import {
  type OperationalSegmentCondition,
  type OperationalSegmentDefinition,
  operationalSegmentDefinitionSchema,
} from './contracts';

const OPERATIONAL_SEGMENT_TYPE = 'operational-segment.v1';
const SEGMENT_CANDIDATE_LIMIT = 10_000;

export class OperationalSegmentNotFoundError extends Error {}
export class OperationalSegmentForbiddenError extends Error {}
export class OperationalSegmentDependencyError extends Error {
  constructor(public dependencies: SegmentDependencies) {
    super('This Segment is still used by saved analytical work.');
  }
}
export class OperationalSegmentBudgetError extends Error {}

type SegmentDependencies = {
  insights: Array<{ id: string; title: string }>;
  dashboards: number;
};

function jsonContainsId(value: unknown, id: string): boolean {
  if (value === id) return true;
  if (Array.isArray(value)) return value.some(item => jsonContainsId(item, id));
  if (value && typeof value === 'object')
    return Object.values(value).some(item => jsonContainsId(item, id));
  return false;
}

async function dependencyMap(projectId: string, segmentIds: string[]) {
  const result = new Map<string, SegmentDependencies>(
    segmentIds.map(id => [id, { insights: [], dashboards: 0 }]),
  );
  if (!segmentIds.length) return result;
  const insights = await prisma.client.insight.findMany({
    where: { projectId },
    select: {
      id: true,
      title: true,
      query: true,
      _count: { select: { dashboardWidgets: true } },
    },
    take: 500,
  });
  for (const insight of insights) {
    for (const segmentId of segmentIds) {
      if (!jsonContainsId(insight.query, segmentId)) continue;
      const dependencies = result.get(segmentId) as SegmentDependencies;
      dependencies.insights.push({ id: insight.id, title: insight.title });
      dependencies.dashboards += insight._count.dashboardWidgets;
    }
  }
  return result;
}

function toDto(record: any, dependencies: SegmentDependencies) {
  return {
    id: record.id,
    projectId: record.websiteId,
    name: record.name,
    definition: operationalSegmentDefinitionSchema.parse(record.parameters),
    dependencies,
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export async function listOperationalSegments(access: InsightAccess) {
  const records = await prisma.client.segment.findMany({
    where: { websiteId: access.projectId, type: OPERATIONAL_SEGMENT_TYPE },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 100,
  });
  const dependencies = await dependencyMap(
    access.projectId,
    records.map(record => record.id),
  );
  return {
    data: records.map(record =>
      toDto(record, dependencies.get(record.id) ?? { insights: [], dashboards: 0 }),
    ),
  };
}

export async function getOperationalSegment(access: InsightAccess, segmentId: string) {
  const record = await prisma.client.segment.findFirst({
    where: { id: segmentId, websiteId: access.projectId, type: OPERATIONAL_SEGMENT_TYPE },
  });
  if (!record) throw new OperationalSegmentNotFoundError('Segment was not found.');
  const dependencies = await dependencyMap(access.projectId, [segmentId]);
  return toDto(record, dependencies.get(segmentId) ?? { insights: [], dashboards: 0 });
}

export async function createOperationalSegment(
  access: InsightAccess,
  name: string,
  definition: OperationalSegmentDefinition,
) {
  if (!(access.canCreateSegments ?? access.canCreate))
    throw new OperationalSegmentForbiddenError('This role cannot save Segments.');
  const normalized = operationalSegmentDefinitionSchema.parse(definition);
  const record = await prisma.client.segment.create({
    data: {
      id: randomUUID(),
      websiteId: access.projectId,
      type: OPERATIONAL_SEGMENT_TYPE,
      name,
      parameters: normalized as Prisma.InputJsonValue,
    },
  });
  return toDto(record, { insights: [], dashboards: 0 });
}

export async function updateOperationalSegment({
  access,
  segmentId,
  name,
  definition,
}: {
  access: InsightAccess;
  segmentId: string;
  name?: string;
  definition?: OperationalSegmentDefinition;
}) {
  if (!(access.canCreateSegments ?? access.canCreate))
    throw new OperationalSegmentForbiddenError('This role cannot edit Segments.');
  await getOperationalSegment(access, segmentId);
  const record = await prisma.client.segment.update({
    where: { id: segmentId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(definition !== undefined
        ? {
            parameters: operationalSegmentDefinitionSchema.parse(
              definition,
            ) as Prisma.InputJsonValue,
          }
        : {}),
    },
  });
  const dependencies = await dependencyMap(access.projectId, [segmentId]);
  return toDto(record, dependencies.get(segmentId) ?? { insights: [], dashboards: 0 });
}

export async function deleteOperationalSegment(access: InsightAccess, segmentId: string) {
  if (!(access.canCreateSegments ?? access.canCreate))
    throw new OperationalSegmentForbiddenError('This role cannot delete Segments.');
  const segment = await getOperationalSegment(access, segmentId);
  if (segment.dependencies.insights.length || segment.dependencies.dashboards)
    throw new OperationalSegmentDependencyError(segment.dependencies);
  await prisma.client.segment.delete({ where: { id: segmentId } });
}

function textMatches(actual: unknown, expected: string, operator: string) {
  const left = String(actual ?? '');
  const leftFolded = left.toLocaleLowerCase();
  const rightFolded = expected.toLocaleLowerCase();
  if (operator === 'equals') return left === expected;
  if (operator === 'notEquals') return left !== expected;
  if (operator === 'contains') return leftFolded.includes(rightFolded);
  return !leftFolded.includes(rightFolded);
}

async function behaviorMembers(
  projectId: string,
  entity: OperationalSegmentDefinition['entity'],
  condition: Extract<OperationalSegmentCondition, { kind: 'behavior' }>,
) {
  const since = new Date(Date.now() - condition.withinDays * 86_400_000);
  const rows = await prisma.rawQuery(
    entity === 'user'
      ? `
        select tu.tracked_user_id::text as id
        from tracked_user tu
        join session s on s.website_id = tu.project_id and s.distinct_id = tu.external_id
        join website_event we on we.website_id = s.website_id and we.session_id = s.session_id
        where tu.project_id = {{projectId::uuid}}
          and we.event_name = {{eventName}}
          and we.created_at >= {{since}}
        group by tu.tracked_user_id
        having count(*) >= {{minCount}}
      `
      : `
        select am.tracked_account_id::text as id
        from account_membership am
        join tracked_user tu on tu.tracked_user_id = am.tracked_user_id
          and tu.project_id = am.project_id
        join session s on s.website_id = tu.project_id and s.distinct_id = tu.external_id
        join website_event we on we.website_id = s.website_id and we.session_id = s.session_id
        where am.project_id = {{projectId::uuid}}
          and we.event_name = {{eventName}}
          and we.created_at >= {{since}}
        group by am.tracked_account_id
        having count(*) >= {{minCount}}
      `,
    {
      projectId,
      eventName: condition.eventName,
      since,
      minCount: condition.minCount,
    },
    'operational_segment_behavior',
  );
  return new Set<string>((rows as Array<{ id: string }>).map(row => row.id));
}

export async function previewOperationalSegment(
  access: InsightAccess,
  input: OperationalSegmentDefinition,
) {
  if (!(access.canCreateSegments ?? access.canCreate))
    throw new OperationalSegmentForbiddenError('This role cannot preview Segment members.');
  const definition = operationalSegmentDefinitionSchema.parse(input);
  const sensitive = canViewSensitiveTraits(access.permissionScope as any);
  const candidates =
    definition.entity === 'user'
      ? await prisma.client.trackedUser.findMany({
          where: { projectId: access.projectId },
          select: {
            id: true,
            externalId: true,
            displayName: true,
            traits: true,
            lifecycleStage: true,
          },
          orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
          take: SEGMENT_CANDIDATE_LIMIT + 1,
        })
      : await prisma.client.trackedAccount.findMany({
          where: { projectId: access.projectId },
          select: { id: true, externalId: true, name: true, traits: true, lifecycleStage: true },
          orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
          take: SEGMENT_CANDIDATE_LIMIT + 1,
        });
  if (candidates.length > SEGMENT_CANDIDATE_LIMIT)
    throw new OperationalSegmentBudgetError(
      `Segment preview is limited to ${SEGMENT_CANDIDATE_LIMIT.toLocaleString()} identities.`,
    );

  const sets = await Promise.all(
    definition.conditions.map(async condition => {
      if (condition.kind === 'behavior')
        return behaviorMembers(access.projectId, definition.entity, condition);
      return new Set(
        candidates
          .filter(candidate =>
            condition.kind === 'lifecycle'
              ? candidate.lifecycleStage === condition.value
              : textMatches(
                  (candidate.traits as Record<string, unknown>)[condition.field],
                  condition.value,
                  condition.operator,
                ),
          )
          .map(candidate => candidate.id),
      );
    }),
  );
  const matches = candidates.filter(candidate =>
    definition.match === 'all'
      ? sets.every(set => set.has(candidate.id))
      : sets.some(set => set.has(candidate.id)),
  );
  return {
    exactness: 'exact' as const,
    evaluatedAt: new Date().toISOString(),
    entity: definition.entity,
    count: matches.length,
    sample: matches.slice(0, 10).map(candidate => ({
      id: candidate.id,
      label: sensitive
        ? (('displayName' in candidate ? candidate.displayName : candidate.name) ??
          candidate.externalId)
        : `${definition.entity === 'user' ? 'Tracked user' : 'Account'} ${candidate.id.slice(0, 8)}`,
      lifecycleStage: candidate.lifecycleStage,
    })),
  };
}
