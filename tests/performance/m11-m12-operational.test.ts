import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import prisma from '@/lib/prisma';
import { deleteWebsite } from '@/queries/prisma/website';
import { saveRecording } from '@/queries/sql/replays/saveRecording';
import { getEvidenceReplay, getSessionEvidence } from '@/server/evidence/evidence-service';
import { listTrackedUsers } from '@/server/identities/read-service';

const IDENTITY_COUNT = 10_000;
const SESSION_EVENT_COUNT = 1_000;
const SAMPLES = 10;
const projectId = randomUUID();
const namespace = randomUUID();
const sessionId = randomUUID();
const visitId = randomUUID();

function percentile(values: number[], quantile: number) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.ceil(sorted.length * quantile) - 1, sorted.length - 1)];
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

describe('M11-M12 operational performance on a 10k-identity evidence dataset', () => {
  beforeAll(async () => {
    await prisma.client.website.create({
      data: {
        id: projectId,
        name: 'M11-M12 operational benchmark',
        domain: `${projectId}.operational-perf.test`,
        replayConfig: { replayEnabled: true, maskLevel: 'strict' },
      },
    });
    await prisma.client.$executeRawUnsafe(
      `insert into tracked_user (
        tracked_user_id, project_id, external_id, display_name, traits, sensitive_traits,
        lifecycle_stage, definition_version, first_seen_at, last_seen_at, updated_at
      )
      select md5($2 || '-user-' || value::text)::uuid, $1::uuid, 'user-' || value::text,
        'User ' || value::text, jsonb_build_object('plan', case when value % 2 = 0 then 'enterprise' else 'starter' end),
        '{}'::jsonb, case when value % 3 = 0 then 'activated' else 'onboarding' end,
        'signal-studio.activation.v1', now() - interval '30 days',
        now() - (value % 1000) * interval '1 second', now()
      from generate_series(0, ${IDENTITY_COUNT - 1}) value`,
      projectId,
      namespace,
    );
    await prisma.client.session.create({
      data: {
        id: sessionId,
        websiteId: projectId,
        distinctId: 'user-0',
        browser: 'Chrome',
        device: 'desktop',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    });
    await prisma.client.$executeRawUnsafe(
      `insert into website_event (
        event_id, website_id, session_id, visit_id, created_at, url_path, event_type, event_name, lcp, inp, cls
      )
      select md5($2 || '-event-' || value::text)::uuid, $1::uuid, $3::uuid, $4::uuid,
        timestamptz '2026-03-01T00:00:00Z' + value * interval '1 second', '/workspace', 2,
        'core_feature_used', 1200, 80, 0.05
      from generate_series(1, ${SESSION_EVENT_COUNT}) value`,
      projectId,
      namespace,
      sessionId,
      visitId,
    );
    for (let chunk = 0; chunk < 5; chunk += 1) {
      await saveRecording({
        websiteId: projectId,
        sessionId,
        visitId,
        chunkIndex: chunk,
        events: [
          { type: 4, timestamp: 1_772_323_200_000 + chunk, data: { width: 1280, height: 720 } },
        ],
        eventCount: 1,
        startedAt: new Date('2026-03-01T00:00:00.000Z'),
        endedAt: new Date('2026-03-01T00:00:05.000Z'),
      });
    }
    await prisma.client.$executeRawUnsafe('vacuum (analyze) tracked_user');
    await prisma.client.$executeRawUnsafe('vacuum (analyze) website_event');
  }, 120_000);

  afterAll(async () => {
    await deleteWebsite(projectId);
    await prisma.client.$disconnect();
  }, 120_000);

  test('keeps cursor pages within budget and records evidence/replay readiness', async () => {
    const pageDurations: number[] = [];
    const evidenceDurations: number[] = [];
    const replayDurations: number[] = [];
    for (let index = 0; index < SAMPLES; index += 1) {
      let started = performance.now();
      const page = await listTrackedUsers({
        projectId,
        scope: 'identity-sensitive',
        lifecycle: 'activated',
        limit: 50,
      });
      pageDurations.push(performance.now() - started);
      expect(page.data).toHaveLength(50);

      started = performance.now();
      const evidence = await getSessionEvidence({
        projectId,
        scope: 'identity-sensitive',
        query: { sessionId, limit: 50, urlPath: '/workspace' },
      });
      evidenceDurations.push(performance.now() - started);
      expect(evidence.timeline.data).toHaveLength(50);

      started = performance.now();
      const replay = await getEvidenceReplay(projectId, visitId, 'identity-sensitive');
      replayDurations.push(performance.now() - started);
      expect(replay).toMatchObject({ eventCount: 5, chunkCount: 5, bounded: false });
    }

    const metrics = {
      environment: `PostgreSQL 15 Alpine in isolated signal-studio-transform Docker; Node ${process.version}; Windows host; fixture vacuumed/analyzed`,
      dataset: {
        trackedUsers: IDENTITY_COUNT,
        sessionEvents: SESSION_EVENT_COUNT,
        replayChunks: 5,
        pageSize: 50,
      },
      samples: SAMPLES,
      userPageP50Ms: round(percentile(pageDurations, 0.5)),
      userPageP95Ms: round(percentile(pageDurations, 0.95)),
      evidencePageP50Ms: round(percentile(evidenceDurations, 0.5)),
      evidencePageP95Ms: round(percentile(evidenceDurations, 0.95)),
      replayPayloadReadyP50Ms: round(percentile(replayDurations, 0.5)),
      replayPayloadReadyP95Ms: round(percentile(replayDurations, 0.95)),
    };
    const evidenceDirectory = resolve(process.cwd(), 'docs/evidence/m11-m12');
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      resolve(evidenceDirectory, 'operational-performance.json'),
      `${JSON.stringify(metrics, null, 2)}\n`,
    );
    console.info(`M11_M12_PERFORMANCE ${JSON.stringify(metrics)}`);
    expect(metrics.userPageP95Ms).toBeLessThan(800);
  }, 120_000);
});
