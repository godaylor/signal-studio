import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { InsightAccess } from '@/server/permissions/insights';
import { type BehavioralCohortDefinition, behavioralCohortDefinitionSchema } from './contracts';

const COHORT_TYPE = 'behavioral-cohort.v1';

export class CohortForbiddenError extends Error {}

function toDto(record: {
  id: string;
  websiteId: string;
  name: string;
  parameters: Prisma.JsonValue;
  createdAt: Date | null;
  updatedAt: Date | null;
}) {
  return {
    id: record.id,
    projectId: record.websiteId,
    name: record.name,
    definition: behavioralCohortDefinitionSchema.parse(record.parameters),
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export async function listCohorts(access: InsightAccess) {
  const records = await prisma.client.segment.findMany({
    where: { websiteId: access.projectId, type: COHORT_TYPE },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 100,
  });
  return { data: records.map(toDto) };
}

export async function createCohort(
  access: InsightAccess,
  name: string,
  definition: BehavioralCohortDefinition,
) {
  if (!access.canCreate) throw new CohortForbiddenError('This role cannot save Cohorts.');
  const normalized = behavioralCohortDefinitionSchema.parse(definition);
  const record = await prisma.client.segment.create({
    data: {
      id: randomUUID(),
      websiteId: access.projectId,
      type: COHORT_TYPE,
      name,
      parameters: normalized as Prisma.InputJsonValue,
    },
  });
  return toDto(record);
}
