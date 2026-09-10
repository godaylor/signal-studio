import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { getWebsiteStats } from '@/queries/sql/getWebsiteStats';
import { getFunnel } from '@/queries/sql/reports/getFunnel';
import { getRetention } from '@/queries/sql/reports/getRetention';
import { GOLDEN_RANGE, GOLDEN_TIMEZONE, summarizeLegacyProduction } from '@/test/analytics/golden';
import { seedGoldenPostgres } from './fixtures/golden-postgres';

const expected = summarizeLegacyProduction();

describe('PostgreSQL analytics golden seed', () => {
  let websiteId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ websiteId, cleanup } = await seedGoldenPostgres());
  });

  afterAll(async () => {
    await cleanup?.();
    await prisma.client.$disconnect();
  });

  test('preserves visitor identity separately from product user and account traits', async () => {
    const aliceSessions = await prisma.client.session.findMany({
      where: { websiteId, distinctId: 'visitor-alice' },
      select: { id: true, distinctId: true },
    });
    const aliceTraits = await prisma.client.sessionData.findMany({
      where: { websiteId, distinctId: 'visitor-alice' },
      select: { dataKey: true, stringValue: true },
      orderBy: [{ dataKey: 'asc' }, { stringValue: 'asc' }],
    });

    expect(aliceSessions).toHaveLength(2);
    expect(new Set(aliceSessions.map(item => item.distinctId))).toEqual(new Set(['visitor-alice']));
    expect(aliceTraits).toEqual([
      { dataKey: 'account_id', stringValue: 'acme' },
      { dataKey: 'account_id', stringValue: 'acme' },
      { dataKey: 'user_id', stringValue: 'user-alice' },
      { dataKey: 'user_id', stringValue: 'user-alice' },
    ]);
  });

  test('returns exact legacy stats whose visitors field counts sessions', async () => {
    const result = await getWebsiteStats(websiteId, {
      ...GOLDEN_RANGE,
      timezone: GOLDEN_TIMEZONE,
    });

    const { websiteStats } = expected;

    expect(
      Object.fromEntries(Object.entries(result).map(([key, value]) => [key, Number(value)])),
    ).toEqual({
      pageviews: websiteStats.pageviews,
      visitors: websiteStats.visitorsFieldSessions,
      visits: websiteStats.visits,
      bounces: websiteStats.bounces,
      totaltime: websiteStats.totalTimeSeconds,
    });
  });

  test('returns the exact ordered legacy session funnel and excludes the end boundary', async () => {
    const result = await getFunnel(
      websiteId,
      {
        ...GOLDEN_RANGE,
        window: 7 * 24 * 60,
        steps: [
          { type: 'event', value: 'signup' },
          { type: 'event', value: 'onboarding_completed' },
          { type: 'event', value: 'core_feature_used' },
        ],
      },
      {},
    );

    expect(result.map(item => ({ step: item.value, visitors: item.visitors }))).toEqual(
      expected.funnel.map(item => ({ step: item.step, visitors: item.sessions })),
    );
  });

  test('returns generic session first-touch retention including Bob and anonymous day zero', async () => {
    const result = await getRetention(
      websiteId,
      { ...GOLDEN_RANGE, timezone: GOLDEN_TIMEZONE },
      {},
    );
    const snapshot = result.map(item => ({
      cohort: String(item.date).slice(0, 10),
      day: Number(item.day),
      visitors: Number(item.visitors),
      returnVisitors: Number(item.returnVisitors),
      percentage: Number(item.percentage),
    }));

    expect(snapshot).toEqual(
      expected.retention.map(item => ({
        cohort: item.cohort,
        day: item.day,
        visitors: item.sessions,
        returnVisitors: item.returnSessions,
        percentage: item.percentage,
      })),
    );
  });
});
