import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import { encodeExport } from '@/server/exports/format';
import { artifactPath, removeArtifact, writeArtifact } from '@/server/exports/storage';

test('100k synthetic identity rows stream to encrypted storage with bounded heap', async () => {
  const previousStorage = process.env.EXPORT_STORAGE_PATH;
  const previousSecret = process.env.APP_SECRET;
  process.env.EXPORT_STORAGE_PATH = path.resolve('.local/performance-exports');
  process.env.APP_SECRET = randomUUID() + randomUUID();
  const key = `${randomUUID()}.${randomUUID()}.bin`;
  const startHeap = process.memoryUsage().heapUsed;
  let peakHeap = startHeap;
  let rows = 0;
  let bytes = 0;
  const started = performance.now();
  try {
    await writeArtifact(key, encodeExport({ metadata: { dataset: '100k synthetic identities; no DB query', exactness: 'exact' }, columns: ['id', 'traits'], rows: (async function* () {
      for (let i = 0; i < 100_000; i++) yield { id: String(i), traits: { plan: 'pro', sample: 'x'.repeat(160) } };
    })() }, 'json', { rows: 100_000, bytes: 64 * 1024 * 1024 }, (count, size) => { rows = count; bytes = size; if (count % 1000 === 0) peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed); }));
    expect(rows).toBe(100_000);
    expect((await stat(artifactPath(key))).size).toBe(bytes + 28);
    expect(peakHeap - startHeap).toBeLessThan(64 * 1024 * 1024);
    console.info(JSON.stringify({ event: 'm15.stream.performance', dataset: '100000 synthetic identities', runtime: process.version, platform: process.platform, rows, bytes, durationMs: Math.round(performance.now() - started), sampledHeapGrowthBytes: peakHeap - startHeap }));
  } finally {
    await removeArtifact(key);
    if (previousStorage === undefined) delete process.env.EXPORT_STORAGE_PATH; else process.env.EXPORT_STORAGE_PATH = previousStorage;
    if (previousSecret === undefined) delete process.env.APP_SECRET; else process.env.APP_SECRET = previousSecret;
  }
});
