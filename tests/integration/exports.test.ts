import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { Auth } from '@/lib/types';
import type { CreateExport } from '@/server/exports/contracts';
import { exportDb as db } from '@/server/exports/database';
import {
  cancelExport,
  createExport,
  downloadExport,
  listExportJobs,
} from '@/server/exports/service';
import { artifactPath, writeArtifact } from '@/server/exports/storage';
import { cleanupExports, runExportOnce } from '@/server/exports/worker';

const run = randomUUID();
const ids = {
  owner: randomUUID(),
  outsider: randomUUID(),
  project: randomUUID(),
  user: randomUUID(),
};
const directory = path.resolve('.local/test-exports', run);
const previousStorage = process.env.EXPORT_STORAGE_PATH;
const previousSecret = process.env.APP_SECRET;
const auth = (id: string): Auth => ({
  user: { id, username: `m15-${id}`, role: 'user', isAdmin: false },
});
const definition = (allRows = true): CreateExport => ({
  version: 1,
  source: { kind: 'users', list: { limit: 50, sort: 'lastSeenAt', direction: 'desc' } },
  format: 'json',
  allRows,
  idempotencyKey: randomUUID(),
});
async function enqueue(input = definition()) {
  const result = await createExport(auth(ids.owner), ids.project, input, randomUUID());
  if (result.kind !== 'job') throw new Error('Expected job');
  return result.job;
}

describe('M15 PostgreSQL exports', () => {
  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.includes('_test_'))
      throw new Error('M15 exports tests require an explicitly named _test_ database');
    process.env.EXPORT_STORAGE_PATH = directory;
    process.env.APP_SECRET = randomUUID() + randomUUID();
    await mkdir(directory, { recursive: true });
    await db.user.createMany({
      data: [ids.owner, ids.outsider].map(id => ({
        id,
        username: `m15-${id}`,
        password: 'x'.repeat(60),
        role: 'user',
      })),
    });
    await db.website.create({
      data: { id: ids.project, userId: ids.owner, name: 'M15 sample', domain: 'm15.example' },
    });
    await db.trackedUser.create({
      data: {
        id: ids.user,
        projectId: ids.project,
        externalId: 'export-user',
        displayName: '=unsafe',
        sensitiveTraits: { email: 'private@example.invalid' },
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  });
  afterAll(async () => {
    await db.exportJob.deleteMany({ where: { projectId: ids.project } });
    await db.securityAuditEvent.deleteMany({
      where: { actorUserId: { in: [ids.owner, ids.outsider] } },
    });
    await db.trackedUser.deleteMany({ where: { projectId: ids.project } });
    await db.website.deleteMany({ where: { id: ids.project } });
    await db.user.deleteMany({ where: { id: { in: [ids.owner, ids.outsider] } } });
    // Only this UUID-scoped test directory; never touches the normal artifact store.
    await rm(directory, { recursive: true, force: true });
    if (previousStorage === undefined) delete process.env.EXPORT_STORAGE_PATH;
    else process.env.EXPORT_STORAGE_PATH = previousStorage;
    if (previousSecret === undefined) delete process.env.APP_SECRET;
    else process.env.APP_SECRET = previousSecret;
    await db.$disconnect();
  });

  test('visible page downloads synchronously with metadata and owner scope', async () => {
    const result = await createExport(
      auth(ids.owner),
      ids.project,
      definition(false),
      randomUUID(),
    );
    expect(result.kind).toBe('download');
    if (result.kind === 'download') {
      const data = JSON.parse(result.data.toString());
      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].sensitiveTraits.email).toBe('private@example.invalid');
      expect(data.metadata.permissionScope).toBe('identity-sensitive');
    }
  });
  test('queue is idempotent; conflicting reuse is rejected', async () => {
    const input = definition();
    const first = await enqueue(input);
    expect((await enqueue(input)).id).toBe(first.id);
    await expect(enqueue({ ...input, format: 'csv' })).rejects.toMatchObject({
      code: 'export-idempotency-conflict',
    });
    await cancelExport(auth(ids.owner), ids.project, first.id);
  });
  test('worker publishes encrypted artifact; requester can download', async () => {
    const job = await enqueue();
    expect(await runExportOnce()).toBe(true);
    const record = await db.exportJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(record).toMatchObject({ status: 'completed', rowCount: 1, attempts: 1 });
    expect(
      (await readFile(artifactPath(record.artifactKey!))).includes(
        Buffer.from('private@example.invalid'),
      ),
    ).toBe(false);
    const result = await downloadExport(auth(ids.owner), ids.project, job.id);
    expect((await new Response(result.data).json()).rows).toHaveLength(1);
  });
  test('cross-tenant requester cannot create/list/download jobs', async () => {
    await expect(
      createExport(auth(ids.outsider), ids.project, definition(), randomUUID()),
    ).rejects.toMatchObject({ status: 403 });
    await expect(listExportJobs(auth(ids.outsider), ids.project)).rejects.toMatchObject({
      status: 403,
    });
    const job = await enqueue();
    await expect(downloadExport(auth(ids.outsider), ids.project, job.id)).rejects.toMatchObject({
      status: 403,
    });
    await cancelExport(auth(ids.owner), ids.project, job.id);
  });
  test('session revocation blocks download after successful completion', async () => {
    const job = await enqueue();
    await runExportOnce();
    await db.user.update({ where: { id: ids.owner }, data: { sessionVersion: { increment: 1 } } });
    await expect(downloadExport(auth(ids.owner), ids.project, job.id)).rejects.toMatchObject({
      code: 'export-access-revoked',
    });
  });
  test('live role change blocks access after successful completion', async () => {
    const job = await enqueue();
    await runExportOnce();
    await db.website.update({ where: { id: ids.project }, data: { userId: ids.outsider } });
    try {
      await expect(downloadExport(auth(ids.owner), ids.project, job.id)).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await db.website.update({ where: { id: ids.project }, data: { userId: ids.owner } });
    }
  });
  test('expired artifact cannot download before cleanup and is physically removed', async () => {
    const job = await enqueue();
    await runExportOnce();
    const record = await db.exportJob.update({
      where: { id: job.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(downloadExport(auth(ids.owner), ids.project, job.id)).rejects.toMatchObject({
      code: 'export-expired',
    });
    await cleanupExports();
    await expect(readFile(artifactPath(record.artifactKey!))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect((await db.exportJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(
      'expired',
    );
  });
  test('cancellation prevents worker execution', async () => {
    const job = await enqueue();
    await cancelExport(auth(ids.owner), ids.project, job.id);
    expect(await runExportOnce()).toBe(false);
    expect(
      (await listExportJobs(auth(ids.owner), ids.project)).find(item => item.id === job.id)?.status,
    ).toBe('cancelled');
  });
  test('quota rejects fourth active export', async () => {
    const jobs = [await enqueue(), await enqueue(), await enqueue()];
    try {
      await expect(enqueue()).rejects.toMatchObject({ code: 'export-active-limit' });
    } finally {
      for (const job of jobs) await cancelExport(auth(ids.owner), ids.project, job.id);
    }
  });
  test('concurrent retry keys create one job and competing workers claim it once', async () => {
    const input = definition();
    const [first, second] = await Promise.all([enqueue(input), enqueue(input)]);
    expect(first.id).toBe(second.id);
    expect((await Promise.all([runExportOnce(), runExportOnce()])).sort()).toEqual([false, true]);
    expect((await db.exportJob.findUniqueOrThrow({ where: { id: first.id } })).attempts).toBe(1);
  });
  test('stale lease retries with a new owned artifact and removes only the recorded old key', async () => {
    const job = await enqueue();
    const leaseId = randomUUID();
    const oldKey = `${job.id}.${leaseId}.bin`;
    await db.exportJob.update({ where: { id: job.id }, data: { status: 'running', leaseId, artifactKey: oldKey, attempts: 1, startedAt: new Date(Date.now() - 360_000) } });
    await writeArtifact(oldKey, (async function* () { yield Buffer.from('interrupted test artifact'); })());
    expect(await runExportOnce()).toBe(true);
    const record = await db.exportJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(record).toMatchObject({ status: 'completed', attempts: 2 });
    expect(record.artifactKey).not.toBe(oldKey);
    await expect(readFile(artifactPath(oldKey))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  test('exhausted stale jobs become failed instead of retrying forever', async () => {
    const job = await enqueue();
    await db.exportJob.update({ where: { id: job.id }, data: { status: 'running', attempts: 3, startedAt: new Date(Date.now() - 360_000) } });
    await cleanupExports();
    expect((await db.exportJob.findUniqueOrThrow({ where: { id: job.id } })).errorCode).toBe('export-worker-attempts-exhausted');
    expect(await runExportOnce()).toBe(false);
  });
  test('serverless queue publishes, downloads and expires a private remote artifact', async () => {
    const objects = new Map<string, Uint8Array>();
    vi.stubEnv('SIGNAL_STUDIO_SERVERLESS', '1');
    vi.stubEnv('EXPORT_STORAGE_BACKEND', 'supabase');
    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-test-key');
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
      const key = new URL(url).pathname.split('/').at(-1)!;
      if (options.method === 'POST') { objects.set(key, new Uint8Array(options.body as Uint8Array)); return new Response('{}'); }
      if (options.method === 'DELETE') { for (const name of JSON.parse(options.body as string).prefixes) objects.delete(name); return new Response('[]'); }
      return objects.has(key) ? new Response(new Uint8Array(objects.get(key)!)) : new Response('{}', { status: 404 });
    }));
    try {
      const job = await enqueue();
      expect(await runExportOnce(job.id)).toBe(true);
      expect(await runExportOnce(job.id)).toBe(false);
      const result = await downloadExport(auth(ids.owner), ids.project, job.id);
      expect((await new Response(result.data).json()).rows).toHaveLength(1);
      expect(objects.size).toBe(1);
      await expect(downloadExport(auth(ids.outsider), ids.project, job.id)).rejects.toBeDefined();
      await db.exportJob.update({ where: { id: job.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await cleanupExports(new Date(), 2);
      expect(objects.size).toBe(0);
      await expect(downloadExport(auth(ids.owner), ids.project, job.id)).rejects.toMatchObject({ code: 'export-expired' });
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
  });
});
