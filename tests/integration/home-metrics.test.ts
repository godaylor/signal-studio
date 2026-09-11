import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { executeMetricPostgresql } from '@/server/analytics/adapters/metric-postgresql';
import { normalizeAnalysisQuery } from '@/server/analytics/normalize';
import { parseAnalysisQueryUrl, serializeAnalysisQuery } from '@/server/analytics/url-codec';

describe('M16 Home metric golden PostgreSQL', () => {
  const projectId = randomUUID();
  const otherProjectId = randomUUID();
  const users = [randomUUID(), randomUUID(), randomUUID()];
  const account = randomUUID();
  const sessions = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const startAt = '2026-06-01T00:00:00.000Z';
  const endAt = '2026-06-08T00:00:00.000Z';
  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL ?? '').pathname.includes('_test_'))
      throw new Error('Isolated test DB required');
    await prisma.client.website.createMany({
      data: [projectId, otherProjectId].map(id => ({
        id,
        name: 'M16 golden',
        domain: 'golden.test',
      })),
    });
    await prisma.client.trackedUser.createMany({
      data: users.map((id, index) => ({
        id,
        projectId,
        externalId: 'user-' + index,
        firstSeenAt: new Date(startAt),
        lastSeenAt: new Date(endAt),
      })),
    });
    await prisma.client.trackedAccount.create({
      data: {
        id: account,
        projectId,
        externalId: 'golden-account',
        firstSeenAt: new Date(startAt),
        lastSeenAt: new Date(endAt),
      },
    });
    await prisma.client.accountMembership.createMany({
      data: users.slice(0, 2).map(trackedUserId => ({
        id: randomUUID(),
        projectId,
        trackedUserId,
        trackedAccountId: account,
        observedAt: new Date(startAt),
      })),
    });
    await prisma.client.session.createMany({
      data: sessions.map((id, index) => ({
        id,
        websiteId: projectId,
        distinctId: index === 4 ? null : 'user-' + (index === 3 ? 0 : index),
        createdAt: new Date(startAt),
        country: index === 1 ? 'DE' : 'US',
      })),
    });
    async function event(session: number, day: string, name: string) {
      const id = randomUUID();
      await prisma.client.websiteEvent.create({
        data: {
          id,
          websiteId: projectId,
          sessionId: sessions[session],
          visitId: randomUUID(),
          createdAt: new Date(day),
          urlPath: '/app',
          eventType: 2,
          eventName: name,
        },
      });
      return id;
    }
    // User 0: same identity across two sessions, activated and retained exactly at +7d.
    await event(0, startAt, 'signup');
    await event(0, '2026-06-01T01:00:00Z', 'onboarding_completed');
    const purchase = await event(3, '2026-06-01T02:00:00Z', 'core_feature_used');
    await event(3, '2026-06-08T02:00:00Z', 'core_feature_used');
    // User 1: activated; return at +14d is excluded, not retained.
    await event(1, '2026-06-02T00:00:00Z', 'signup');
    await event(1, '2026-06-02T01:00:00Z', 'onboarding_completed');
    await event(1, '2026-06-02T02:00:00Z', 'core_feature_used');
    await event(1, '2026-06-16T02:00:00Z', 'core_feature_used');
    // User 2: core before onboarding does not activate.
    await event(2, '2026-06-03T00:00:00Z', 'signup');
    await event(2, '2026-06-03T01:00:00Z', 'core_feature_used');
    await event(2, '2026-06-03T02:00:00Z', 'onboarding_completed');
    await event(4, '2026-06-04T00:00:00Z', 'signup'); // anonymous excluded
    await event(0, endAt, 'boundary-only'); // half-open exclusion
    await prisma.client.revenue.createMany({
      data: [
        { currency: 'USD', revenue: 12.5 },
        { currency: 'USD', revenue: -2.5 },
        { currency: 'EUR', revenue: 100 },
      ].map(row => ({
        id: randomUUID(),
        websiteId: projectId,
        sessionId: sessions[3],
        eventId: purchase,
        eventName: 'core_feature_used',
        createdAt: new Date('2026-06-01T02:00:00Z'),
        ...row,
      })),
    });
  });
  afterAll(async () => {
    await prisma.client.revenue.deleteMany({ where: { websiteId: projectId } });
    await prisma.client.websiteEvent.deleteMany({ where: { websiteId: projectId } });
    await prisma.client.session.deleteMany({ where: { websiteId: projectId } });
    await prisma.client.accountMembership.deleteMany({ where: { projectId } });
    await prisma.client.trackedUser.deleteMany({ where: { projectId } });
    await prisma.client.trackedAccount.deleteMany({ where: { projectId } });
    await prisma.client.website.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.client.$disconnect();
  });
  function query(measure: Record<string, unknown>, overrides = {}) {
    return normalizeAnalysisQuery({
      version: 1,
      projectId,
      mode: 'trend',
      range: { startAt, endAt, timezone: 'UTC', unit: 'day' },
      measure,
      filters: [],
      match: 'all',
      comparison: 'none',
      visualization: 'table',
      ...overrides,
    });
  }
  test('distinct totals do not sum daily values, deduplicate sessions and exclude anonymous actors', async () => {
    const result = await executeMetricPostgresql(
      query({ source: 'event', key: '*', aggregation: 'uniqueUsers' }),
    );
    expect(result.total.value).toBe(3);
    expect(
      (
        await executeMetricPostgresql(
          query({ source: 'event', key: '*', aggregation: 'uniqueAccounts' }),
        )
      ).total.value,
    ).toBe(1);
    expect(
      (await executeMetricPostgresql(query({ source: 'event', key: '*', aggregation: 'sessions' })))
        .total.value,
    ).toBe(5);
  });
  test('breaks distinct users down by session dimensions without a filter on that dimension', async () => {
    const result = await executeMetricPostgresql(query(
      { source: 'event', key: '*', aggregation: 'uniqueUsers' },
      { mode: 'breakdown', breakdown: { field: 'country', limit: 10 } },
    ));
    expect(result.total.value).toBe(3);
    expect(result.rows).toEqual([{ key: 'US', value: 2 }, { key: 'DE', value: 1 }]);
  });
  test('ordered lifecycle has exact denominators and half-open retention boundaries', async () => {
    const activation = await executeMetricPostgresql(
      query({ source: 'lifecycle', key: 'activated', aggregation: 'count' }),
    );
    expect(activation.total).toEqual({ value: 2, denominator: 3, rate: 2 / 3 });
    const retention = await executeMetricPostgresql(
      query({ source: 'lifecycle', key: 'retained', aggregation: 'count' }),
    );
    expect(retention.total).toEqual({ value: 1, denominator: 2, rate: 0.5 });
  });
  test('does not mix currencies and includes recorded refunds', async () => {
    const result = await executeMetricPostgresql(
      query({ source: 'revenue', key: '*', aggregation: 'sum', property: 'USD' }),
    );
    expect(result.total.value).toBe(10);
  });
  test('filters cohort at signup, enforces project scope and represents empty denominator as unavailable', async () => {
    const result = await executeMetricPostgresql(
      query(
        { source: 'lifecycle', key: 'activated', aggregation: 'count' },
        { filters: [{ field: 'country', operator: 'equals', value: 'DE' }] },
      ),
    );
    expect(result.total).toEqual({ value: 1, denominator: 1, rate: 1 });
    const empty = await executeMetricPostgresql(
      query(
        { source: 'lifecycle', key: 'activated', aggregation: 'count' },
        { projectId: otherProjectId },
      ),
    );
    expect(empty.total).toEqual({ value: 0, denominator: 0, rate: null });
    expect(
      (
        await executeMetricPostgresql(
          query({ source: 'event', key: 'boundary-only', aggregation: 'uniqueUsers' }),
        )
      ).total.value,
    ).toBe(0);
  });
  test('new sources round-trip through the existing canonical Explore URL', () => {
    for (const source of ['lifecycle', 'revenue'] as const) {
      const input = query(
        source === 'lifecycle'
          ? { source, key: 'activated', aggregation: 'count' }
          : { source, key: '*', aggregation: 'sum', property: 'USD' },
      );
      expect(parseAnalysisQueryUrl(serializeAnalysisQuery(input))).toEqual(input);
    }
  });
});
