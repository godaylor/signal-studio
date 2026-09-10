import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AnalysisQueryV1 } from './contracts';
import { normalizeAnalysisQuery } from './normalize';
import { parseAnalysisQueryUrl, serializeAnalysisQuery } from './url-codec';

const { rawQueryMock } = vi.hoisted(() => ({ rawQueryMock: vi.fn() }));

vi.mock('@/lib/prisma', () => ({ default: { rawQuery: rawQueryMock } }));

import {
  executeAdvancedPostgresql,
  getAdvancedAnalysisMembers,
} from './adapters/advanced-postgresql';

const projectId = '00000000-0000-4000-8000-000000000919';

function event(
  actorId: string,
  eventId: string,
  createdAt: string,
  eventName: string,
  properties: Record<string, unknown> = {},
) {
  return {
    actorId,
    eventId,
    createdAt,
    eventName,
    properties,
    sessionId: `${eventId}0000000-0000-4000-8000-000000000000`.slice(0, 36),
    distinctId: actorId.startsWith('session:') ? null : actorId,
    urlPath: '/',
    browser: 'Chrome',
    os: 'Windows',
    device: 'desktop',
    country: 'US',
  };
}

function funnelQuery(): AnalysisQueryV1 {
  return normalizeAnalysisQuery({
    version: 1,
    projectId,
    mode: 'funnel',
    range: {
      startAt: '2026-01-01T00:00:00.000Z',
      endAt: '2026-02-01T00:00:00.000Z',
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
}

function retentionQuery(): AnalysisQueryV1 {
  return normalizeAnalysisQuery({
    version: 1,
    projectId,
    mode: 'retention',
    range: {
      startAt: '2026-03-01T00:00:00.000Z',
      endAt: '2026-03-20T00:00:00.000Z',
      timezone: 'America/New_York',
      unit: 'day',
    },
    measure: { source: 'event', key: 'signup', aggregation: 'count' },
    retention: {
      entry: { type: 'event', value: 'signup', filters: [] },
      returning: { type: 'event', value: 'active', filters: [] },
      granularity: 'day',
      periods: 3,
    },
    filters: [],
    match: 'all',
    comparison: 'none',
    visualization: 'matrix',
  });
}

describe('advanced AnalysisQuery v1 PostgreSQL semantics', () => {
  beforeEach(() => rawQueryMock.mockReset());

  test('orders repeated events deterministically, honors the inclusive conversion window, properties and drop-off', async () => {
    rawQueryMock.mockResolvedValue([
      event(
        'user-a',
        '00000000-0000-4000-8000-000000000003',
        '2026-01-02T01:00:00.000Z',
        'purchase',
      ),
      event(
        'user-a',
        '00000000-0000-4000-8000-000000000001',
        '2026-01-02T00:00:00.000Z',
        'signup',
        { plan: 'pro' },
      ),
      event(
        'user-a',
        '00000000-0000-4000-8000-000000000002',
        '2026-01-02T00:00:00.000Z',
        'activate',
      ),
      event(
        'user-b',
        '00000000-0000-4000-8000-000000000011',
        '2026-01-03T00:00:00.000Z',
        'signup',
        { plan: 'pro' },
      ),
      event(
        'user-b',
        '00000000-0000-4000-8000-000000000012',
        '2026-01-03T00:30:00.000Z',
        'activate',
      ),
      event(
        'user-c',
        '00000000-0000-4000-8000-000000000021',
        '2026-01-04T00:00:00.000Z',
        'signup',
        { plan: 'free' },
      ),
    ]);

    const rows = await executeAdvancedPostgresql(funnelQuery());
    const steps = rows.filter((row: any) => row.kind === 'funnel-step') as any[];
    expect(steps.map(row => [row.converted, row.dropped])).toEqual([
      [2, 0],
      [2, 0],
      [1, 1],
    ]);
    expect(steps[2].overallConversionRate).toBe(0.5);
    expect(rows.filter((row: any) => row.kind === 'funnel-duration')).toMatchObject([
      { bucket: '<1m', converted: 0 },
      { bucket: '1–5m', converted: 0 },
      { bucket: '5–15m', converted: 0 },
      { bucket: '15–60m', converted: 0 },
      { bucket: '60m+', converted: 1 },
    ]);
  });

  test('returns exact dropped membership with linked user/account/sessions', async () => {
    const events = [
      event(
        'member-1',
        '00000000-0000-4000-8000-000000000031',
        '2026-01-05T00:00:00.000Z',
        'signup',
        { plan: 'pro' },
      ),
      event(
        'member-2',
        '00000000-0000-4000-8000-000000000041',
        '2026-01-05T00:00:00.000Z',
        'signup',
        { plan: 'pro' },
      ),
      event(
        'member-2',
        '00000000-0000-4000-8000-000000000042',
        '2026-01-05T00:10:00.000Z',
        'activate',
      ),
    ];
    rawQueryMock.mockResolvedValueOnce(events).mockResolvedValueOnce([
      {
        actorId: 'member-1',
        trackedUserId: 'u1',
        userExternalId: 'member-1',
        displayName: 'Member One',
        trackedAccountId: 'a1',
        accountExternalId: 'account-1',
        accountName: 'Acme',
      },
    ]);
    const result = await getAdvancedAnalysisMembers(funnelQuery(), {
      kind: 'funnel-step',
      step: 2,
      outcome: 'dropped',
    });
    expect(result.total).toBe(1);
    expect(result.members[0]).toMatchObject({
      actorId: 'member-1',
      trackedUser: { id: 'u1' },
      account: { id: 'a1' },
    });
  });

  test('assigns entry once across the DST boundary and counts exact N-period returns', async () => {
    rawQueryMock.mockResolvedValue([
      event('user-a', '00000000-0000-4000-8000-000000000051', '2026-03-08T06:30:00.000Z', 'signup'),
      event('user-a', '00000000-0000-4000-8000-000000000052', '2026-03-08T07:30:00.000Z', 'signup'),
      event('user-a', '00000000-0000-4000-8000-000000000053', '2026-03-09T05:00:00.000Z', 'active'),
      event('user-a', '00000000-0000-4000-8000-000000000054', '2026-03-10T05:00:00.000Z', 'active'),
      event('user-b', '00000000-0000-4000-8000-000000000061', '2026-03-08T08:00:00.000Z', 'signup'),
    ]);
    const rows = await executeAdvancedPostgresql(retentionQuery());
    expect(rows.filter((row: any) => row.cohortStart === '2026-03-08')).toMatchObject([
      { period: 0, cohortSize: 2, retained: 2, retentionRate: 1 },
      { period: 1, cohortSize: 2, retained: 1, retentionRate: 0.5 },
      { period: 2, cohortSize: 2, retained: 1, retentionRate: 0.5 },
      { period: 3, cohortSize: 2, retained: 0, retentionRate: 0 },
    ]);
  });

  test.each([funnelQuery(), retentionQuery()])(
    'round-trips advanced state through the URL and Insight contract',
    query => {
      expect(parseAnalysisQueryUrl(serializeAnalysisQuery(query))).toEqual(query);
    },
  );
});
