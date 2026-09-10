import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { deleteWebsite } from '@/queries/prisma/website';
import { createAnalysisQueryService } from '@/server/analytics/query-service';
import type { AnalysisQueryTelemetry } from '@/server/analytics/telemetry';

const EVENT_COUNT = 1_000_000;
const MEASURED_QUERIES = 10;
const projectId = randomUUID();
const datasetNamespace = randomUUID();

function percentile(values: number[], quantile: number) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.ceil(sorted.length * quantile) - 1, sorted.length - 1)];
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function query() {
  return {
    version: 1,
    projectId,
    mode: 'trend',
    range: {
      startAt: '2026-03-01T00:00:00.000Z',
      endAt: '2026-03-11T00:00:00.000Z',
      timezone: 'UTC',
      unit: 'day',
    },
    measure: { source: 'event', key: 'signup', aggregation: 'count' },
    filters: [],
    match: 'all',
    comparison: 'none',
    visualization: 'line',
  };
}

type ExplainNode = {
  'Relation Name'?: string;
  'Actual Rows'?: number;
  'Actual Loops'?: number;
  'Rows Removed by Filter'?: number;
  'Rows Removed by Index Recheck'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  Plans?: ExplainNode[];
};

function baseScanMetrics(node: ExplainNode): { rows: number; bytes: number } {
  const loops = node['Actual Loops'] ?? 1;
  const own =
    node['Relation Name'] === 'website_event'
      ? {
          rows:
            ((node['Actual Rows'] ?? 0) +
              (node['Rows Removed by Filter'] ?? 0) +
              (node['Rows Removed by Index Recheck'] ?? 0)) *
            loops,
          bytes:
            ((node['Shared Hit Blocks'] ?? 0) + (node['Shared Read Blocks'] ?? 0)) * 8192,
        }
      : { rows: 0, bytes: 0 };

  return (node.Plans ?? []).reduce(
    (total, child) => {
      const metrics = baseScanMetrics(child);
      return { rows: total.rows + metrics.rows, bytes: total.bytes + metrics.bytes };
    },
    own,
  );
}

describe('M5 AnalysisQuery performance on the reference 1M-event dataset', () => {
  beforeAll(async () => {
    await prisma.client.website.create({
      data: { id: projectId, name: 'M5 1M benchmark', domain: `${projectId}.m5-perf.test` },
    });

    await prisma.client.$executeRawUnsafe(
      `
      insert into website_event (
        event_id, website_id, session_id, visit_id, created_at,
        url_path, event_type, event_name
      )
      select
        md5($2 || '-event-' || value::text)::uuid,
        $1::uuid,
        md5($2 || '-session-' || (value % 10000)::text)::uuid,
        md5($2 || '-visit-' || (value % 100000)::text)::uuid,
        timestamptz '2026-03-01T00:00:00Z' +
          (value % 864000) * interval '1 second',
        case when value % 2 = 0 then '/app/onboarding' else '/app/product' end,
        2,
        case when value % 4 = 0 then 'signup' else 'feature_used' end
      from generate_series(1, ${EVENT_COUNT}) as value
      `,
      projectId,
      datasetNamespace,
    );
  });

  afterAll(async () => {
    await deleteWebsite(projectId);
    await prisma.client.$disconnect();
  });

  test('measures planner, PostgreSQL, cache and scanned work', async () => {
    const totalDurations: number[] = [];
    const plannerDurations: number[] = [];
    const sqlDurations: number[] = [];

    for (let index = 0; index < MEASURED_QUERIES; index += 1) {
      const telemetry: AnalysisQueryTelemetry[] = [];
      const service = createAnalysisQueryService({ telemetry: event => telemetry.push(event) });
      const startedAt = performance.now();
      const result = await service.execute({
        query: query(),
        projectId,
        tenantId: 'm5-performance-tenant',
        permissionScope: 'identity-standard',
        requestId: `m5-performance-${index}`,
      });
      totalDurations.push(performance.now() - startedAt);
      plannerDurations.push(telemetry[0].plannerMs);
      sqlDurations.push(telemetry[0].sqlMs);
      expect(result.data.rows.reduce((sum, row) => sum + row.value, 0)).toBe(250_000);
    }

    const cachedTelemetry: AnalysisQueryTelemetry[] = [];
    const cachedService = createAnalysisQueryService({
      telemetry: event => cachedTelemetry.push(event),
    });
    const cacheInput = {
      query: query(),
      projectId,
      tenantId: 'm5-cache-tenant',
      permissionScope: 'identity-standard',
    };
    await cachedService.execute({ ...cacheInput, requestId: 'm5-cache-miss' });
    const cacheStartedAt = performance.now();
    const cachedResult = await cachedService.execute({ ...cacheInput, requestId: 'm5-cache-hit' });
    const cacheHitMs = performance.now() - cacheStartedAt;

    const explain = await prisma.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      explain (analyze, buffers, format json)
      select count(*)
      from website_event
      where website_id = $1::uuid
        and created_at >= timestamptz '2026-03-01T00:00:00Z'
        and created_at < timestamptz '2026-03-11T00:00:00Z'
        and event_type = 2
        and event_name = 'signup'
      `,
      projectId,
    );
    const rawPlan = explain[0]['QUERY PLAN'];
    const parsedPlan = typeof rawPlan === 'string' ? JSON.parse(rawPlan) : rawPlan;
    const planRoot = (parsedPlan as Array<{ Plan: ExplainNode }>)[0].Plan;
    const scan = baseScanMetrics(planRoot);

    const metrics = {
      environment:
        'PostgreSQL 15 Alpine in local Docker; Node 22.15.1; Windows host; one Project',
      dataset: {
        events: EVENT_COUNT,
        signupEvents: 250_000,
        eventSessions: 10_000,
        eventVisits: 100_000,
        rangeDays: 10,
      },
      samples: MEASURED_QUERIES,
      totalP50Ms: round(percentile(totalDurations, 0.5)),
      totalP95Ms: round(percentile(totalDurations, 0.95)),
      plannerP50Ms: round(percentile(plannerDurations, 0.5)),
      plannerP95Ms: round(percentile(plannerDurations, 0.95)),
      sqlP50Ms: round(percentile(sqlDurations, 0.5)),
      sqlP95Ms: round(percentile(sqlDurations, 0.95)),
      cacheHitMs: round(cacheHitMs),
      rowsScanned: Math.round(scan.rows),
      bytesScannedApprox: Math.round(scan.bytes),
      exactness: 'exact',
    };

    const evidenceDirectory = resolve(process.cwd(), 'docs/evidence/m5');
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      resolve(evidenceDirectory, 'analysis-query-performance.json'),
      `${JSON.stringify(metrics, null, 2)}\n`,
    );
    console.info(`M5_PERFORMANCE ${JSON.stringify(metrics)}`);

    expect(cachedResult.cache).toBe('hit');
    expect(cachedTelemetry.at(-1)).toMatchObject({ cache: 'hit', sqlMs: 0 });
    expect(metrics.totalP95Ms).toBeLessThan(1500);
    expect(metrics.cacheHitMs).toBeLessThan(300);
    expect(metrics.rowsScanned).toBeGreaterThanOrEqual(250_000);
    expect(metrics.rowsScanned).toBeLessThanOrEqual(EVENT_COUNT);
  });
});
