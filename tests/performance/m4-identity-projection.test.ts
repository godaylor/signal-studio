import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { deleteWebsite } from '@/queries/prisma/website';
import { listTrackedUsers } from '@/server/identities/read-service';
import { upsertTrackedIdentity } from '@/server/identities/upsert';
import { M4_DEMO_IDS, seedM4Demo } from '../../scripts/seed-m4-demo-data.js';

const EVENT_COUNT = 1_000_000;
const MEASURED_UPSERTS = 200;
const MEASURED_PAGE_READS = 30;
const projectId = randomUUID();
const seedProjectId = randomUUID();
const datasetNamespace = randomUUID();
const seedIds = Object.fromEntries(
  Object.keys(M4_DEMO_IDS).map(key => [key, randomUUID()]),
) as Record<keyof typeof M4_DEMO_IDS, string>;

function percentile(values: number[], quantile: number) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.ceil(sorted.length * quantile) - 1, sorted.length - 1)];
}

describe('M4 identity performance on the reference 1M-event shape', () => {
  beforeAll(async () => {
    await prisma.client.website.createMany({
      data: [
        { id: projectId, name: 'M4 1M benchmark', domain: 'm4-perf.test' },
        { id: seedProjectId, name: 'M4 seed benchmark', domain: 'm4-seed-perf.test' },
      ],
    });
  });

  afterAll(async () => {
    await deleteWebsite(projectId);
    await deleteWebsite(seedProjectId);
    await prisma.client.$disconnect();
  });

  test('records seed, projection and bounded account/user page latency', async () => {
    const seedStartedAt = performance.now();
    await seedM4Demo(prisma.client, { projectId: seedProjectId, ids: seedIds });
    const seedDurationMs = performance.now() - seedStartedAt;

    const factLoadStartedAt = performance.now();
    await prisma.client.$executeRawUnsafe(
      `
      insert into website_event (
        event_id, website_id, session_id, visit_id, created_at, url_path, event_type
      )
      select
        md5($2 || '-event-' || value::text)::uuid,
        $1::uuid,
        md5($2 || '-session-' || (value % 10000)::text)::uuid,
        md5($2 || '-visit-' || (value % 100000)::text)::uuid,
        timestamptz '2026-03-01T00:00:00Z' + (value % 86400) * interval '1 second',
        '/app/feature',
        2
      from generate_series(1, ${EVENT_COUNT}) as value
      `,
      projectId,
      datasetNamespace,
    );
    const factLoadDurationMs = performance.now() - factLoadStartedAt;
    const factCount = await prisma.client.websiteEvent.count({ where: { websiteId: projectId } });

    for (let index = 0; index < 20; index += 1) {
      await upsertTrackedIdentity({
        projectId,
        externalId: `warm-user-${index}`,
        account: { id: `warm-account-${index % 5}` },
        observedAt: new Date('2026-03-10T00:00:00.000Z'),
      });
    }

    const upsertDurations: number[] = [];
    for (let index = 0; index < MEASURED_UPSERTS; index += 1) {
      const startedAt = performance.now();
      await upsertTrackedIdentity({
        projectId,
        externalId: `measured-user-${index % 100}`,
        traits: { plan: index % 2 ? 'pro' : 'starter' },
        account: { id: `measured-account-${index % 20}`, traits: { industry: 'software' } },
        observedAt: new Date(1_773_100_800_000 + index * 1000),
      });
      upsertDurations.push(performance.now() - startedAt);
    }

    const pageDurations: number[] = [];
    for (let index = 0; index < MEASURED_PAGE_READS; index += 1) {
      const startedAt = performance.now();
      const page = await listTrackedUsers({
        projectId,
        scope: 'identity-sensitive',
        limit: 50,
      });
      expect(page.data.length).toBeGreaterThan(0);
      pageDurations.push(performance.now() - startedAt);
    }

    const metrics = {
      environment:
        'PostgreSQL 15 Alpine in local Docker; Node 22.15.1; Windows host; one Project',
      dataset: {
        events: factCount,
        eventSessions: 10_000,
        eventVisits: 100_000,
        measuredIdentityObservations: MEASURED_UPSERTS,
      },
      seedDurationMs: Math.round(seedDurationMs * 100) / 100,
      factLoadDurationMs: Math.round(factLoadDurationMs * 100) / 100,
      projectionP50Ms: Math.round(percentile(upsertDurations, 0.5) * 100) / 100,
      projectionP95Ms: Math.round(percentile(upsertDurations, 0.95) * 100) / 100,
      userPageP50Ms: Math.round(percentile(pageDurations, 0.5) * 100) / 100,
      userPageP95Ms: Math.round(percentile(pageDurations, 0.95) * 100) / 100,
    };

    const evidenceDirectory = resolve(process.cwd(), 'docs/evidence/m4');
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      resolve(evidenceDirectory, 'identity-performance.json'),
      `${JSON.stringify(metrics, null, 2)}\n`,
    );
    console.info(`M4_PERFORMANCE ${JSON.stringify(metrics)}`);
    expect(factCount).toBe(EVENT_COUNT);
    expect(metrics.projectionP95Ms).toBeLessThan(800);
    expect(metrics.userPageP95Ms).toBeLessThan(800);
  });
});
