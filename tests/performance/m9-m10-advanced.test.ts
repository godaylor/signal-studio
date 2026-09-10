import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { deleteWebsite } from '@/queries/prisma/website';
import { createAnalysisQueryService } from '@/server/analytics/query-service';

const EVENT_COUNT = 1_000_000;
const ACTOR_COUNT = 10_000;
const SAMPLES = 5;
const projectId = randomUUID();
const namespace = randomUUID();

function percentile(values: number[], quantile: number) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.ceil(sorted.length * quantile) - 1, sorted.length - 1)];
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

type ExplainNode = {
  'Node Type'?: string;
  'Index Name'?: string;
  'Actual Rows'?: number;
  'Rows Removed by Filter'?: number;
  Plans?: ExplainNode[];
};

function planEvidence(node: ExplainNode): {
  nodes: string[];
  indexes: string[];
  scannedRows: number;
} {
  return (node.Plans ?? []).reduce(
    (total, child) => {
      const nested = planEvidence(child);
      return {
        nodes: [...total.nodes, ...nested.nodes],
        indexes: [...total.indexes, ...nested.indexes],
        scannedRows: total.scannedRows + nested.scannedRows,
      };
    },
    {
      nodes: node['Node Type'] ? [node['Node Type']] : [],
      indexes: node['Index Name'] ? [node['Index Name']] : [],
      scannedRows: (node['Actual Rows'] ?? 0) + (node['Rows Removed by Filter'] ?? 0),
    },
  );
}

function base(mode: 'funnel' | 'retention') {
  return {
    version: 1,
    projectId,
    mode,
    range: {
      startAt: '2026-03-01T00:00:00.000Z',
      endAt: '2026-03-31T00:00:00.000Z',
      timezone: 'UTC',
      unit: 'day',
    },
    measure: { source: 'event', key: 'signup', aggregation: 'count' },
    filters: [],
    match: 'all',
    comparison: 'none',
  };
}

function funnelQuery() {
  return {
    ...base('funnel'),
    funnel: {
      steps: [
        { type: 'event', value: 'signup', filters: [] },
        { type: 'event', value: 'activate', filters: [] },
        { type: 'event', value: 'purchase', filters: [] },
        { type: 'event', value: 'core_feature_used', filters: [] },
      ],
      conversionWindowMinutes: 60,
    },
    visualization: 'bar',
  };
}

function retentionQuery() {
  return {
    ...base('retention'),
    retention: {
      entry: { type: 'event', value: 'signup', filters: [] },
      returning: { type: 'event', value: 'active', filters: [] },
      granularity: 'day',
      periods: 12,
    },
    visualization: 'matrix',
  };
}

describe('M9-M10 advanced analytics performance on reference 1M-event dataset', () => {
  beforeAll(async () => {
    await prisma.client.website.create({
      data: {
        id: projectId,
        name: 'M9-M10 1M benchmark',
        domain: `${projectId}.advanced-perf.test`,
      },
    });
    await prisma.client.$executeRawUnsafe(
      `insert into session (session_id, website_id, distinct_id, created_at)
       select md5($2 || '-session-' || value::text)::uuid, $1::uuid, 'actor-' || value::text,
         timestamptz '2026-03-01T00:00:00Z'
       from generate_series(0, ${ACTOR_COUNT - 1}) value`,
      projectId,
      namespace,
    );
    await prisma.client.$executeRawUnsafe(
      `insert into website_event (
        event_id, website_id, session_id, visit_id, created_at, url_path, event_type, event_name
      )
      select
        md5($2 || '-event-' || value::text)::uuid,
        $1::uuid,
        md5($2 || '-session-' || (((value - 1) / 100)::int % ${ACTOR_COUNT})::text)::uuid,
        md5($2 || '-visit-' || (((value - 1) / 100)::int % ${ACTOR_COUNT})::text)::uuid,
        timestamptz '2026-03-01T00:00:00Z' + (value % 2500000) * interval '1 second',
        '/app',
        2,
        case (value - 1) % 100
          when 0 then 'signup'
          when 1 then 'activate'
          when 2 then 'purchase'
          when 3 then 'core_feature_used'
          when 4 then 'active'
          else 'noise'
        end
      from generate_series(1, ${EVENT_COUNT}) value`,
      projectId,
      namespace,
    );
    // Repeated benchmark runs delete and recreate the owned 1M-event fixture. Vacuuming
    // removes prior-run dead tuples and fixes planner statistics before measuring p95.
    await prisma.client.$executeRawUnsafe('vacuum (analyze) website_event');
    await prisma.client.$executeRawUnsafe('analyze session');
  }, 120_000);

  afterAll(async () => {
    await deleteWebsite(projectId);
    await prisma.client.$disconnect();
  }, 120_000);

  test('stays inside funnel/retention p95 budgets and closes cache behavior', async () => {
    const funnelDurations: number[] = [];
    const retentionDurations: number[] = [];
    for (let index = 0; index < SAMPLES; index += 1) {
      for (const [query, samples, tenant] of [
        [funnelQuery(), funnelDurations, `m9-${index}`],
        [retentionQuery(), retentionDurations, `m10-${index}`],
      ] as const) {
        const service = createAnalysisQueryService();
        const started = performance.now();
        const result = await service.execute({
          query,
          projectId,
          tenantId: tenant,
          permissionScope: 'identity-sensitive',
        });
        samples.push(performance.now() - started);
        expect(result.exactness).toBe('exact');
        expect(result.data.rows.length).toBeGreaterThan(0);
      }
    }

    const cacheService = createAnalysisQueryService();
    const input = {
      query: retentionQuery(),
      projectId,
      tenantId: 'm10-cache',
      permissionScope: 'identity-sensitive',
    };
    await cacheService.execute(input);
    const cacheStarted = performance.now();
    const cached = await cacheService.execute(input);
    const explain = await prisma.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `explain (analyze, buffers, format json)
       select count(*) from website_event
       where website_id = $1::uuid
         and created_at >= timestamptz '2026-03-01T00:00:00Z'
         and created_at < timestamptz '2026-03-31T00:00:00Z'
         and event_name in ('signup', 'activate', 'purchase', 'core_feature_used')`,
      projectId,
    );
    const rawPlan = explain[0]['QUERY PLAN'];
    const root = (typeof rawPlan === 'string' ? JSON.parse(rawPlan) : rawPlan) as Array<{
      Plan: ExplainNode;
    }>;
    const plan = planEvidence(root[0].Plan);
    const metrics = {
      environment: `PostgreSQL 15 Alpine in isolated signal-studio-transform Docker; Node ${process.version}; Windows host; fixture vacuumed/analyzed before samples`,
      dataset: { events: EVENT_COUNT, actors: ACTOR_COUNT, relevantEvents: 50_000, rangeDays: 30 },
      samples: SAMPLES,
      funnel4StepP50Ms: round(percentile(funnelDurations, 0.5)),
      funnel4StepP95Ms: round(percentile(funnelDurations, 0.95)),
      retention12PeriodP50Ms: round(percentile(retentionDurations, 0.5)),
      retention12PeriodP95Ms: round(percentile(retentionDurations, 0.95)),
      cacheHitMs: round(performance.now() - cacheStarted),
      plan: {
        nodeTypes: [...new Set(plan.nodes)],
        indexes: [...new Set(plan.indexes)],
        scannedRows: plan.scannedRows,
      },
      exactness: 'exact',
    };
    const evidenceDirectory = resolve(process.cwd(), 'docs/evidence/m9-m10');
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      resolve(evidenceDirectory, 'advanced-performance.json'),
      `${JSON.stringify(metrics, null, 2)}\n`,
    );
    console.info(`M9_M10_PERFORMANCE ${JSON.stringify(metrics)}`);

    expect(cached.cache).toBe('hit');
    expect(metrics.funnel4StepP95Ms).toBeLessThan(2500);
    expect(metrics.retention12PeriodP95Ms).toBeLessThan(3000);
    expect(metrics.cacheHitMs).toBeLessThan(300);
    expect(metrics.plan.indexes.some(index => index.includes('event_name_created_at'))).toBe(true);
  }, 120_000);
});
