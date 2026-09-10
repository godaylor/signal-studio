import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, afterAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { buildMetricStatement, executeMetricPostgresql } from '@/server/analytics/adapters/metric-postgresql';
import { normalizeAnalysisQuery } from '@/server/analytics/normalize';
const projectId = randomUUID();
const namespace = randomUUID();
const sqlId = (kind: string, index: string) => `md5($2 || '-${kind}-' || ${index}::text)::uuid`;
describe('M16 Home exact metrics / 1M events / 10k TrackedUsers', () => {
  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL ?? '').pathname.includes('_test_')) throw new Error('Isolated test DB required');
    await prisma.client.website.create({ data: { id: projectId, name: 'M16 1M Home benchmark', domain: 'm16-perf.test' } });
    await prisma.client.$executeRawUnsafe(`insert into tracked_user (tracked_user_id, project_id, external_id, first_seen_at, last_seen_at, updated_at)
      select ${sqlId('user', 'n')}, $1::uuid, 'bench-' || n, '2026-06-01'::timestamptz, '2026-06-23'::timestamptz, now()
      from generate_series(0, 9999) n`, projectId, namespace);
    await prisma.client.$executeRawUnsafe(`insert into tracked_account (tracked_account_id, project_id, external_id, first_seen_at, last_seen_at, updated_at)
      select ${sqlId('account', 'n')}, $1::uuid, 'bench-account-' || n, '2026-06-01'::timestamptz, '2026-06-23'::timestamptz, now()
      from generate_series(0, 999) n`, projectId, namespace);
    await prisma.client.$executeRawUnsafe(`insert into account_membership (account_membership_id, project_id, tracked_user_id, tracked_account_id, observed_at, updated_at)
      select ${sqlId('membership', 'n')}, $1::uuid, ${sqlId('user', 'n')}, ${sqlId('account', '(n % 1000)')}, '2026-06-01'::timestamptz, now()
      from generate_series(0, 9999) n`, projectId, namespace);
    await prisma.client.$executeRawUnsafe(`insert into session (session_id, website_id, distinct_id, created_at)
      select ${sqlId('session', 'n')}, $1::uuid, 'bench-' || n, '2026-06-01'::timestamptz from generate_series(0, 9999) n`, projectId, namespace);
    await prisma.client.$executeRawUnsafe(`insert into website_event (event_id, website_id, session_id, visit_id, created_at, url_path, event_type, event_name)
      select ${sqlId('event', 'n')}, $1::uuid, ${sqlId('session', '(n / 100)')}, ${sqlId('session', '(n / 100)')},
        case when n % 100 < 3 then '2026-06-01'::timestamptz + ((n / 100) % 7) * interval '1 day' + (n % 100) * interval '1 hour'
          when n % 100 = 3 then '2026-06-01'::timestamptz + ((n / 100) % 7) * interval '1 day' + interval '2 hours' + (case when (n / 100) % 2 = 0 then 7 else 15 end) * interval '1 day'
          else '2026-06-22'::timestamptz + (n % 604800) * interval '1 second' end,
        '/app', 2, case n % 100 when 0 then 'signup' when 1 then 'onboarding_completed' when 2 then 'core_feature_used' when 3 then 'core_feature_used' else 'feature_report' end
      from generate_series(0, 999999) n`, projectId, namespace);
    // The benchmark bulk-loads 1M rows at once; collect statistics before measuring.
    for (const table of ['website_event', 'session', 'tracked_user', 'tracked_account', 'account_membership']) {
      await prisma.client.$executeRawUnsafe(`ANALYZE ${table}`);
    }
  });
  afterAll(async () => {
    await prisma.client.websiteEvent.deleteMany({ where: { websiteId: projectId } });
    await prisma.client.session.deleteMany({ where: { websiteId: projectId } });
    await prisma.client.accountMembership.deleteMany({ where: { projectId } });
    await prisma.client.trackedUser.deleteMany({ where: { projectId } });
    await prisma.client.trackedAccount.deleteMany({ where: { projectId } });
    await prisma.client.website.deleteMany({ where: { id: projectId } });
    await prisma.client.$disconnect();
  });
  test('measures exact uncached aggregation p50/p95; no larger scale claim', async () => {
    const cases = [
      { id: 'weekly-users', source: 'event', key: '*', aggregation: 'uniqueUsers', expected: 10000 },
      { id: 'weekly-accounts', source: 'event', key: '*', aggregation: 'uniqueAccounts', expected: 1000 },
      { id: 'activation', source: 'lifecycle', key: 'activated', aggregation: 'count', expected: 10000 },
      { id: 'retention', source: 'lifecycle', key: 'retained', aggregation: 'count', expected: 5000 },
    ];
    const metrics: Array<{ id: string; p50Ms: number; p95Ms: number }> = [];
    for (const item of cases) {
      const range = item.source === 'lifecycle' ? { startAt: '2026-06-01T00:00:00.000Z', endAt: '2026-06-08T00:00:00.000Z' } : { startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-06-29T00:00:00.000Z' };
      const query = normalizeAnalysisQuery({ version: 1, projectId, mode: 'trend', range: { ...range, unit: 'week', timezone: 'UTC' }, measure: { source: item.source, key: item.key, aggregation: item.aggregation }, filters: [], match: 'all', comparison: 'none', visualization: 'table' });
      const samples: number[] = [];
      const statement = buildMetricStatement(query);
      const plan = await prisma.client.$queryRawUnsafe('EXPLAIN (FORMAT JSON) ' + statement.sql, ...statement.values);
      const planDirectory = resolve(process.cwd(), 'docs/evidence/m16');
      await mkdir(planDirectory, { recursive: true });
      await writeFile(resolve(planDirectory, item.id + '-plan.json'), JSON.stringify(plan, null, 2) + '\n');
      for (let index = 0; index < 5; index++) {
        const started = performance.now();
        const result = await executeMetricPostgresql(query);
        samples.push(performance.now() - started);
        expect(result.total.value).toBe(item.expected);
      }
      samples.sort((a, b) => a - b);
      metrics.push({ id: item.id, p50Ms: Math.round(samples[2]), p95Ms: Math.round(samples[4]) });
    }
    const evidence = { dataset: { events: 1000000, trackedUsers: 10000, accounts: 1000, sessions: 10000 }, samples: 5,
      runtime: process.version, platform: process.platform, database: 'local Docker PostgreSQL 15', queryCache: 'bypassed', metrics, measuredAt: new Date().toISOString() };
    const directory = resolve(process.cwd(), 'docs/evidence/m16');
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'home-metrics-1m.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.info('M16_HOME_PERFORMANCE ' + JSON.stringify(evidence));
    for (const metric of metrics) expect(metric.p95Ms, metric.id).toBeLessThan(1500);
  });
});
