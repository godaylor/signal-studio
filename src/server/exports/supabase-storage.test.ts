import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  readSupabaseArtifact,
  removeSupabaseArtifact,
  SERVERLESS_EXPORT_BYTES,
  writeSupabaseArtifact,
} from './supabase-storage';

const key = `${randomUUID()}.${randomUUID()}.bin`;
beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-test-key');
  vi.stubEnv('APP_SECRET', randomUUID() + randomUUID());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function* chunks(value: Buffer) {
  yield value;
}

test('private encrypted artifact round trips without plaintext upload', async () => {
  let uploaded: Uint8Array;
  const fetcher = vi.fn(async (_url, options) => {
    expect(options.headers.apikey).toBe('server-only-test-key');
    expect(options.redirect).toBe('error');
    if (options.method === 'POST') {
      uploaded = options.body;
      return new Response('{}');
    }
    return new Response(new Uint8Array(uploaded!));
  });
  vi.stubGlobal('fetch', fetcher);
  await writeSupabaseArtifact(key, chunks(Buffer.from('private-export')));
  expect(Buffer.from(uploaded!).includes(Buffer.from('private-export'))).toBe(false);
  expect(await new Response(await readSupabaseArtifact(key)).text()).toBe('private-export');
  expect(fetcher.mock.calls[0][0]).toBe(
    `https://project.supabase.co/storage/v1/object/signal-exports/${key}`,
  );
});

test('tampered ciphertext never returns plaintext', async () => {
  let uploaded: Uint8Array;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, options) => {
      if (options.method === 'POST') {
        uploaded = options.body;
        return new Response('{}');
      }
      uploaded![uploaded!.length - 1] ^= 1;
      return new Response(new Uint8Array(uploaded!));
    }),
  );
  await writeSupabaseArtifact(key, chunks(Buffer.from('private')));
  await expect(readSupabaseArtifact(key)).rejects.toMatchObject({
    code: 'export-artifact-invalid',
  });
});

test('oversize and invalid keys do not upload anything', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(
    writeSupabaseArtifact(key, chunks(Buffer.alloc(SERVERLESS_EXPORT_BYTES + 1))),
  ).rejects.toMatchObject({ code: 'export-size-limit' });
  await expect(removeSupabaseArtifact('../someone-else')).rejects.toMatchObject({
    code: 'export-artifact-invalid',
  });
  expect(fetcher).not.toHaveBeenCalled();
});

test('cleanup deletes only the exact owned object; provider errors fail closed', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('[]'))
    .mockResolvedValueOnce(new Response('{}', { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  await removeSupabaseArtifact(key);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ prefixes: [key] });
  await expect(removeSupabaseArtifact(key)).rejects.toMatchObject({
    code: 'export-storage-unavailable',
  });
});

test('oversized storage response is rejected even without content-length', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(new Uint8Array(SERVERLESS_EXPORT_BYTES + 29))),
  );
  await expect(readSupabaseArtifact(key)).rejects.toMatchObject({ code: 'export-size-limit' });
});
