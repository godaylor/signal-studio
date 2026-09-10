import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { deleteWebsite } from '@/queries/prisma/website';
import {
  executeAdvancedPostgresql,
  getAdvancedAnalysisMembers,
} from '@/server/analytics/adapters/advanced-postgresql';
import { normalizeAnalysisQuery } from '@/server/analytics/normalize';
import { createCohort, listCohorts } from '@/server/cohorts/cohort-service';

const projectId = randomUUID();
const visitId = randomUUID();
const sessionA = randomUUID();
const sessionB = randomUUID();
const sessionC = randomUUID();
const ids = Array.from(
  { length: 9 },
  (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);

describe('M9-M10 advanced analytics PostgreSQL golden data', () => {
  beforeAll(async () => {
    await prisma.client.website.create({
      data: { id: projectId, name: 'Advanced golden', domain: `${projectId}.advanced.test` },
    });
    await prisma.client.session.createMany({
      data: [
        {
          id: sessionA,
          websiteId: projectId,
          distinctId: 'actor-a',
          browser: 'Chrome',
          country: 'US',
          createdAt: new Date('2026-03-08T06:00:00Z'),
        },
        {
          id: sessionB,
          websiteId: projectId,
          distinctId: 'actor-a',
          browser: 'Chrome',
          country: 'US',
          createdAt: new Date('2026-03-09T04:00:00Z'),
        },
        {
          id: sessionC,
          websiteId: projectId,
          distinctId: 'actor-b',
          browser: 'Safari',
          country: 'CA',
          createdAt: new Date('2026-03-08T07:00:00Z'),
        },
      ],
    });
    await prisma.client.websiteEvent.createMany({
      data: [
        {
          id: ids[0],
          websiteId: projectId,
          sessionId: sessionA,
          visitId,
          createdAt: new Date('2026-03-08T06:30:00Z'),
          urlPath: '/',
          eventType: 2,
          eventName: 'signup',
        },
        {
          id: ids[1],
          websiteId: projectId,
          sessionId: sessionA,
          visitId,
          createdAt: new Date('2026-03-08T06:30:00Z'),
          urlPath: '/',
          eventType: 2,
          eventName: 'activate',
        },
        {
          id: ids[2],
          websiteId: projectId,
          sessionId: sessionA,
          visitId,
          createdAt: new Date('2026-03-08T07:30:00Z'),
          urlPath: '/',
          eventType: 2,
          eventName: 'purchase',
        },
        {
          id: ids[3],
          websiteId: projectId,
          sessionId: sessionB,
          visitId,
          createdAt: new Date('2026-03-09T05:00:00Z'),
          urlPath: '/',
          eventType: 2,
          eventName: 'active',
        },
        {
          id: ids[4],
          websiteId: projectId,
          sessionId: sessionB,
          visitId,
          createdAt: new Date('2026-03-10T05:00:00Z'),
          urlPath: '/',
          eventType: 2,
          eventName: 'active',
        },
        {
          id: ids[5],
          websiteId: projectId,
          sessionId: sessionC,
          visitId,
          createdAt: new Date('2026-03-08T08:00:00Z'),
          urlPath: '/',
          eventType: 2,
          eventName: 'signup',
        },
        {
          id: ids[6],
          websiteId: projectId,
          sessionId: sessionC,
          visitId,
          createdAt: new Date('2026-03-08T08:15:00Z'),
          urlPath: '/',
          eventType: 2,
          eventName: 'activate',
        },
        {
          id: ids[7],
          websiteId: projectId,
          sessionId: sessionC,
          visitId,
          createdAt: new Date('2026-03-08T09:01:00Z'),
          urlPath: '/',
          eventType: 2,
          eventName: 'purchase',
        },
        {
          id: ids[8],
          websiteId: projectId,
          sessionId: sessionC,
          visitId,
          createdAt: new Date('2026-03-09T08:00:00Z'),
          urlPath: '/',
          eventType: 2,
          eventName: 'active',
        },
      ],
    });
    await prisma.client.eventData.create({
      data: {
        id: randomUUID(),
        websiteId: projectId,
        websiteEventId: ids[0],
        dataKey: 'plan',
        stringValue: 'pro',
        dataType: 1,
        createdAt: new Date('2026-03-08T06:30:00Z'),
      },
    });
    await prisma.client.eventData.create({
      data: {
        id: randomUUID(),
        websiteId: projectId,
        websiteEventId: ids[5],
        dataKey: 'plan',
        stringValue: 'pro',
        dataType: 1,
        createdAt: new Date('2026-03-08T08:00:00Z'),
      },
    });
  });

  afterAll(async () => {
    await deleteWebsite(projectId);
    await prisma.client.$disconnect();
  });

  test('computes ordered funnel, exact boundary and dropped actor membership', async () => {
    const query = normalizeAnalysisQuery({
      version: 1,
      projectId,
      mode: 'funnel',
      range: {
        startAt: '2026-03-08T00:00:00Z',
        endAt: '2026-03-11T00:00:00Z',
        timezone: 'UTC',
        unit: 'day',
      },
      measure: { source: 'event', key: 'signup', aggregation: 'count' },
      funnel: {
        steps: [
          {
            type: 'event',
            value: 'signup',
            filters: [{ property: 'plan', operator: 'equals', value: 'pro' }],
          },
          { type: 'event', value: 'activate', filters: [] },
          { type: 'event', value: 'purchase', filters: [] },
        ],
        conversionWindowMinutes: 60,
      },
      filters: [],
      match: 'all',
      comparison: 'none',
      visualization: 'bar',
    });
    const rows = await executeAdvancedPostgresql(query);
    expect(
      rows.filter((row: any) => row.kind === 'funnel-step').map((row: any) => row.converted),
    ).toEqual([2, 2, 1]);
    const members = await getAdvancedAnalysisMembers(query, {
      kind: 'funnel-step',
      step: 3,
      outcome: 'dropped',
    });
    expect(members).toMatchObject({ total: 1, members: [{ actorId: 'actor-b' }] });
  });

  test('computes independent daily retention across sessions and DST', async () => {
    const query = normalizeAnalysisQuery({
      version: 1,
      projectId,
      mode: 'retention',
      range: {
        startAt: '2026-03-08T00:00:00Z',
        endAt: '2026-03-12T00:00:00Z',
        timezone: 'America/New_York',
        unit: 'day',
      },
      measure: { source: 'event', key: 'signup', aggregation: 'count' },
      retention: {
        entry: { type: 'event', value: 'signup', filters: [] },
        returning: { type: 'event', value: 'active', filters: [] },
        granularity: 'day',
        periods: 2,
      },
      filters: [],
      match: 'all',
      comparison: 'none',
      visualization: 'matrix',
    });
    const rows = await executeAdvancedPostgresql(query);
    expect(rows.filter((row: any) => row.cohortStart === '2026-03-08')).toMatchObject([
      { period: 0, cohortSize: 2, retained: 2 },
      { period: 1, cohortSize: 2, retained: 2 },
      { period: 2, cohortSize: 2, retained: 1 },
    ]);
  });

  test('persists a versioned behavioral Cohort and reopens the same definition', async () => {
    const access = {
      actorUserId: randomUUID(),
      projectId,
      tenantId: projectId,
      permissionScope: 'identity-sensitive',
      canCreate: true,
      canManageAll: true,
    };
    const definition = {
      version: 1 as const,
      entry: { type: 'event' as const, value: 'signup', filters: [] },
      returning: { type: 'event' as const, value: 'active', filters: [] },
      granularity: 'day' as const,
      periods: 2,
      filters: [],
      match: 'all' as const,
    };
    const created = await createCohort(access, 'Activated users', definition);
    expect(created.definition).toEqual(definition);
    await expect(listCohorts(access)).resolves.toMatchObject({
      data: [{ id: created.id, name: 'Activated users', definition }],
    });
  });
});
