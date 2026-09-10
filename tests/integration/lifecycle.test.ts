import { randomUUID } from 'node:crypto';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Auth } from '@/lib/types';
import { exportDb as db } from '@/server/exports/database';
import { requireExportAccess } from '@/server/exports/access';
import { artifactPath, writeArtifact } from '@/server/exports/storage';
import { lifecycleRequestSchema } from '@/server/lifecycle/contracts';
import { disconnectLifecycleLocks, withLifecycleIngestion } from '@/server/lifecycle/ingestion';
import { createLifecycle, listLifecycle } from '@/server/lifecycle/service';
import { runLifecycleOnce } from '@/server/lifecycle/worker';

const owner = randomUUID();
const storage = path.resolve('.local/test-lifecycle', owner);
const previousStorage = process.env.EXPORT_STORAGE_PATH;
const previousSecret = process.env.APP_SECRET;
const outsider = randomUUID();
const projects: string[] = [];
const auth = (id = owner): Auth => ({
  user: { id, username: `lifecycle-${id}`, role: 'user', isAdmin: false },
});
const old = new Date('2025-01-01T00:00:00Z');
const boundary = new Date('2025-02-01T00:00:00Z');
async function fixture() {
  const projectId = randomUUID();
  projects.push(projectId);
  await db.website.create({ data: { id: projectId, name: 'Lifecycle test', userId: owner } });
  const user = randomUUID();
  const account = randomUUID();
  const session = randomUUID();
  const event = randomUUID();
  const visit = randomUUID();
  await db.trackedUser.create({
    data: {
      id: user,
      projectId,
      externalId: 'erase-me',
      firstSeenAt: old,
      lastSeenAt: old,
      sensitiveTraits: { email: 'synthetic@example.invalid' },
    },
  });
  await db.trackedAccount.create({
    data: {
      id: account,
      projectId,
      externalId: 'erase-account',
      firstSeenAt: old,
      lastSeenAt: old,
    },
  });
  await db.accountMembership.create({
    data: {
      id: randomUUID(),
      projectId,
      trackedUserId: user,
      trackedAccountId: account,
      observedAt: old,
    },
  });
  // Only session_link carries the identity: regression for legacy ingestion.
  await db.session.create({ data: { id: session, websiteId: projectId, createdAt: old } });
  await db.sessionLink.create({
    data: { websiteId: projectId, sessionId: session, distinctId: 'erase-me', createdAt: old },
  });
  await db.websiteEvent.create({
    data: {
      id: event,
      websiteId: projectId,
      sessionId: session,
      visitId: visit,
      urlPath: '/',
      createdAt: old,
    },
  });
  await db.eventData.create({
    data: {
      id: randomUUID(),
      websiteId: projectId,
      websiteEventId: event,
      dataKey: 'private',
      stringValue: 'synthetic',
      dataType: 1,
      createdAt: old,
    },
  });
  await db.sessionData.create({
    data: {
      id: randomUUID(),
      websiteId: projectId,
      sessionId: session,
      dataKey: 'private',
      stringValue: 'synthetic',
      dataType: 1,
      createdAt: old,
    },
  });
  await db.revenue.create({
    data: {
      id: randomUUID(),
      websiteId: projectId,
      sessionId: session,
      eventId: event,
      eventName: 'paid',
      currency: 'USD',
      revenue: 10,
      createdAt: old,
    },
  });
  await db.sessionReplay.create({
    data: {
      id: randomUUID(),
      websiteId: projectId,
      sessionId: session,
      visitId: visit,
      events: Buffer.from('synthetic'),
      eventCount: 1,
      chunkIndex: 0,
      startedAt: old,
      endedAt: old,
      createdAt: old,
    },
  });
  await db.sessionReplaySaved.create({
    data: {
      id: randomUUID(),
      websiteId: projectId,
      visitId: visit,
      name: 'synthetic',
      createdAt: old,
    },
  });
  await db.heatmapEvent.create({
    data: {
      id: randomUUID(),
      websiteId: projectId,
      sessionId: session,
      visitId: visit,
      urlPath: '/',
      eventType: 1,
      createdAt: old,
    },
  });
  return { projectId, user, account, session };
}
function request(projectId: string, extra = {}) {
  return {
    version: 1,
    idempotencyKey: randomUUID(),
    confirmProjectId: projectId,
    category: 'all',
    target: { kind: 'project' },
    before: boundary.toISOString(),
    ...extra,
  };
}
async function complete(projectId: string) {
  for (let i = 0; i < 70; i++) {
    await runLifecycleOnce();
    const jobs = await listLifecycle(auth(), projectId);
    if (!['queued', 'running'].includes(jobs[0].status)) return jobs[0];
  }
  throw new Error('Bounded lifecycle test did not terminate');
}
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.includes('_test_'))
    throw new Error('Isolated _test_ database required');
  await db.user.createMany({
    data: [owner, outsider].map(id => ({
      id,
      username: `lifecycle-${id}`,
      password: '!'.repeat(60),
      role: 'user',
    })),
  });
  process.env.EXPORT_STORAGE_PATH = storage;
  process.env.APP_SECRET = randomUUID() + randomUUID();
  await mkdir(storage, { recursive: true });
});
afterAll(async () => {
  // Exact UUID-owned test records only, including partially failed cases.
  for (const projectId of projects) {
    await db.exportJob.deleteMany({ where: { projectId } });
    for (const table of [
      'event_data',
      'session_data',
      'revenue',
      'session_replay_saved',
      'session_replay',
      'heatmap_event',
      'website_event',
      'session_link',
      'session',
    ])
      await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE website_id=$1::uuid`, projectId);
    for (const table of [
      'account_membership',
      'tracked_user',
      'tracked_account',
      'data_lifecycle_job',
    ])
      await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE project_id=$1::uuid`, projectId);
    await db.website.delete({ where: { id: projectId } });
  }
  await db.securityAuditEvent.deleteMany({ where: { actorUserId: { in: [owner, outsider] } } });
  await db.user.deleteMany({ where: { id: { in: [owner, outsider] } } });
  await db.$disconnect();
  await disconnectLifecycleLocks();
  await rm(storage, { recursive: true, force: true }); // Only this test's UUID directory.
  if (previousStorage === undefined) delete process.env.EXPORT_STORAGE_PATH;
  else process.env.EXPORT_STORAGE_PATH = previousStorage;
  if (previousSecret === undefined) delete process.env.APP_SECRET;
  else process.env.APP_SECRET = previousSecret;
});
test('owner-only, tenant-scoped, explicit confirmation and bounded cutoff', async () => {
  const f = await fixture();
  await expect(
    createLifecycle(auth(outsider), f.projectId, request(f.projectId)),
  ).rejects.toMatchObject({ status: 403 });
  await expect(listLifecycle(auth(outsider), f.projectId)).rejects.toMatchObject({ status: 403 });
  await expect(
    createLifecycle(auth(), f.projectId, request(f.projectId, { confirmProjectId: randomUUID() })),
  ).rejects.toMatchObject({ code: 'lifecycle-confirmation-mismatch' });
  expect(
    lifecycleRequestSchema.safeParse(request(f.projectId, { before: '2099-01-01T00:00:00Z' }))
      .success,
  ).toBe(false);
});
test('retention physically removes all old stores, preserves cutoff and another tenant', async () => {
  const f = await fixture();
  const foreign = await fixture();
  const recent = randomUUID();
  await db.session.create({ data: { id: recent, websiteId: f.projectId, createdAt: boundary } });
  await db.websiteEvent.create({
    data: {
      id: randomUUID(),
      websiteId: f.projectId,
      sessionId: recent,
      visitId: randomUUID(),
      urlPath: '/kept',
      createdAt: boundary,
    },
  });
  const input = request(f.projectId);
  const job = await createLifecycle(auth(), f.projectId, input);
  expect((await createLifecycle(auth(), f.projectId, input)).id).toBe(job.id);
  await expect(
    createLifecycle(auth(), f.projectId, { ...input, category: 'replay' }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(requireExportAccess(auth(), f.projectId)).rejects.toMatchObject({
    code: 'export-source-maintenance',
  });
  const response = await withLifecycleIngestion(f.projectId, async () => {
    throw new Error('must not write');
  });
  expect(response.status).toBe(503);
  expect(await complete(f.projectId)).toMatchObject({ status: 'completed', errorCode: null });
  expect(await db.websiteEvent.count({ where: { websiteId: f.projectId } })).toBe(1);
  expect(await db.session.count({ where: { websiteId: f.projectId } })).toBe(1);
  for (const model of [
    db.eventData,
    db.sessionData,
    db.sessionReplay,
    db.sessionReplaySaved,
    db.heatmapEvent,
    db.revenue,
  ])
    expect(await (model as typeof db.eventData).count({ where: { websiteId: f.projectId } })).toBe(
      0,
    );
  expect(await db.trackedUser.count({ where: { projectId: f.projectId } })).toBe(0);
  expect(await db.trackedAccount.count({ where: { projectId: f.projectId } })).toBe(0);
  expect(await db.websiteEvent.count({ where: { websiteId: foreign.projectId } })).toBe(1);
  expect((await createLifecycle(auth(), f.projectId, input)).status).toBe('completed');
});
test.each(['user', 'account'] as const)(
  '%s erasure follows session_link and removes evidence/traits',
  async kind => {
    const f = await fixture();
    const input = request(f.projectId, { target: { kind, id: f[kind] } });
    await createLifecycle(
      auth(),
      f.projectId,
      input,
    );
    expect(await complete(f.projectId)).toMatchObject({ status: 'completed' });
    expect(await db.session.count({ where: { websiteId: f.projectId } })).toBe(0);
    expect(await db.trackedUser.findUnique({ where: { id: f.user } })).toBeNull();
    expect(await db.eventData.count({ where: { websiteId: f.projectId } })).toBe(0);
    expect(await db.sessionReplaySaved.count({ where: { websiteId: f.projectId } })).toBe(0);
    expect(await db.accountMembership.count({ where: { projectId: f.projectId } })).toBe(0);
    expect((await createLifecycle(auth(), f.projectId, input)).status).toBe('completed');
  },
);
test.each(['properties', 'replay', 'heatmaps'] as const)('category %s preserves other data', async category => {
  const f = await fixture();
  await createLifecycle(auth(), f.projectId, request(f.projectId, { category }));
  expect(await complete(f.projectId)).toMatchObject({ status: 'completed' });
  expect(await db.websiteEvent.count({ where: { websiteId: f.projectId } })).toBe(1);
  expect(await db.eventData.count({ where: { websiteId: f.projectId } })).toBe(category === 'properties' ? 0 : 1);
  expect(await db.sessionReplay.count({ where: { websiteId: f.projectId } })).toBe(category === 'replay' ? 0 : 1);
  expect(await db.heatmapEvent.count({ where: { websiteId: f.projectId } })).toBe(category === 'heatmaps' ? 0 : 1);
});
test('export erasure unlinks owned encrypted files, never unknown files', async () => {
  const f = await fixture(); const id = randomUUID(); const key = `${id}.${randomUUID()}.bin`;
  await writeArtifact(key, (async function* () { yield Buffer.from('synthetic export'); })());
  const unknown = path.join(storage, 'unowned.txt'); await writeFile(unknown, 'preserve');
  await db.exportJob.create({ data: { id, projectId: f.projectId, requesterId: owner, idempotencyKey: randomUUID(), definitionHash: 'test', definition: {}, permissionScope: 'identity-sensitive', sessionVersion: 0, filename: 'synthetic.json', status: 'completed', artifactKey: key, expiresAt: new Date(Date.now() + 60000) } });
  await createLifecycle(auth(), f.projectId, request(f.projectId, { category: 'exports' }));
  expect(await complete(f.projectId)).toMatchObject({ status: 'completed' });
  await expect(access(artifactPath(key))).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(access(unknown)).resolves.toBeUndefined();
  expect(await db.exportJob.count({ where: { projectId: f.projectId } })).toBe(0);
  expect(await db.websiteEvent.count({ where: { websiteId: f.projectId } })).toBe(1);
});
test('bounded batches resume without duplication and preserve security audit', async () => {
  const f = await fixture();
  await db.websiteEvent.createMany({ data: Array.from({ length: 1100 }, () => ({ id: randomUUID(), websiteId: f.projectId, sessionId: f.session, visitId: randomUUID(), urlPath: '/', createdAt: old })) });
  const auditId = randomUUID(); await db.securityAuditEvent.create({ data: { id: auditId, actorUserId: owner, eventType: 'lifecycle.test', outcome: 'success', createdAt: old } });
  await createLifecycle(auth(), f.projectId, request(f.projectId));
  let previous = 0; let completed = false;
  for (let i=0; i<70; i++) {
    await runLifecycleOnce(); const job = (await listLifecycle(auth(), f.projectId))[0];
    expect(job.deletedRows - previous).toBeLessThanOrEqual(500); previous = job.deletedRows;
    if (job.status === 'completed') { completed = true; break; }
    expect(job.status).toBe('running');
  }
  expect(completed).toBe(true);
  expect(await db.websiteEvent.count({ where: { websiteId: f.projectId } })).toBe(0);
  expect(await db.securityAuditEvent.findUnique({ where: { id: auditId } })).not.toBeNull();
});
test('accepted ingestion finishes before any erasure batch can acquire the project', async () => {
  const f = await fixture(); let release!: () => void; let acquired!: () => void;
  const entered = new Promise<void>(resolve => { acquired=resolve; });
  const pending = withLifecycleIngestion(f.projectId, async () => { acquired(); await new Promise<void>(resolve => { release=resolve; }); return Response.json({ ok: true }); });
  await entered;
  try {
    await createLifecycle(auth(), f.projectId, request(f.projectId));
    expect(await runLifecycleOnce()).toBe(false);
    expect(await db.websiteEvent.count({ where: { websiteId: f.projectId } })).toBe(1);
  } finally { release(); await pending; }
  expect(await complete(f.projectId)).toMatchObject({ status: 'completed' });
});
test('unsupported store is an explicit blocked scope, not false completion', async () => {
  const f = await fixture(); await createLifecycle(auth(), f.projectId, request(f.projectId));
  const oldUrl = process.env.CLICKHOUSE_URL; process.env.CLICKHOUSE_URL = 'http://unsupported.invalid';
  try { expect(await complete(f.projectId)).toMatchObject({ status: 'blocked', errorCode: 'lifecycle-unsupported-store' }); }
  finally { if (oldUrl === undefined) delete process.env.CLICKHOUSE_URL; else process.env.CLICKHOUSE_URL=oldUrl; }
  expect(await db.websiteEvent.count({ where: { websiteId: f.projectId } })).toBe(1);
});
test('20 concurrent ingestion gates do not exhaust the application query pool', async () => {
  const f = await fixture();
  const responses = await Promise.all(Array.from({ length: 20 }, () => withLifecycleIngestion(f.projectId, async () => {
    await db.$queryRaw`SELECT 1 AS alive`; return Response.json({ ok: true });
  })));
  expect(responses.every(response => response.status === 200)).toBe(true);
});
test('revoked session blocks erasure before touching data', async () => {
  const f = await fixture();
  await createLifecycle(auth(), f.projectId, request(f.projectId));
  await db.user.update({ where: { id: owner }, data: { sessionVersion: { increment: 1 } } });
  expect(await complete(f.projectId)).toMatchObject({
    status: 'blocked',
    errorCode: 'lifecycle-access-revoked',
  });
  expect(await db.websiteEvent.count({ where: { websiteId: f.projectId } })).toBe(1);
});
