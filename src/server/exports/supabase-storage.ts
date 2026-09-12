import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ExportError } from './contracts';

// Keep encrypted uploads and authenticated downloads below the Vercel payload cap.
export const SERVERLESS_EXPORT_BYTES = 3 * 1024 * 1024;
const keyPattern = /^[a-f0-9-]{36}\.[a-f0-9-]{36}\.bin$/;

function config(key: string) {
  if (!keyPattern.test(key)) throw new ExportError('export-artifact-invalid');
  const origin = new URL(process.env.SUPABASE_URL || 'https://invalid.local');
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_EXPORT_BUCKET || 'signal-exports';
  if (
    origin.protocol !== 'https:' ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password ||
    !secret ||
    !/^[a-z0-9-]+$/.test(bucket)
  )
    throw new ExportError('export-storage-not-configured', 503);
  if (!process.env.APP_SECRET || process.env.APP_SECRET.length < 32)
    throw new ExportError('export-secret-not-configured', 503);
  return {
    url: `${origin.origin}/storage/v1/object/${bucket}/${key}`,
    readUrl: `${origin.origin}/storage/v1/object/authenticated/${bucket}/${key}`,
    bucketUrl: `${origin.origin}/storage/v1/object/${bucket}`,
    headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    cipherKey: createHash('sha256')
      .update('signal-studio.export.v1:')
      .update(process.env.APP_SECRET)
      .digest(),
  };
}

export async function writeSupabaseArtifact(key: string, chunks: AsyncIterable<Buffer>) {
  const settings = config(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', settings.cipherKey, iv);
  const encrypted: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of chunks) {
    bytes += chunk.length;
    if (bytes > SERVERLESS_EXPORT_BYTES) throw new ExportError('export-size-limit', 413);
    encrypted.push(cipher.update(chunk));
  }
  encrypted.push(cipher.final());
  const response = await fetch(settings.url, {
    method: 'POST',
    headers: {
      ...settings.headers,
      'content-type': 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: new Uint8Array(Buffer.concat([iv, cipher.getAuthTag(), ...encrypted])),
    signal: AbortSignal.timeout(20_000),
    redirect: 'error',
  });
  if (!response.ok) throw new ExportError('export-storage-unavailable', 503);
  await response.body?.cancel();
}

export async function readSupabaseArtifact(key: string): Promise<ReadableStream<Uint8Array>> {
  const settings = config(key);
  const response = await fetch(settings.readUrl, {
    headers: settings.headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
    redirect: 'error',
  });
  if (!response.ok || !response.body) throw new ExportError('export-artifact-unavailable', 410);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > SERVERLESS_EXPORT_BYTES + 28) throw new ExportError('export-size-limit', 413);
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const encrypted = Buffer.concat(chunks);
  if (encrypted.length < 28) throw new ExportError('export-artifact-invalid', 410);
  const decipher = createDecipheriv('aes-256-gcm', settings.cipherKey, encrypted.subarray(0, 12));
  decipher.setAuthTag(encrypted.subarray(12, 28));
  // Authenticate before returning any plaintext to the browser.
  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]);
  } catch {
    throw new ExportError('export-artifact-invalid', 410);
  }
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(plaintext));
      controller.close();
    },
  });
}

export async function removeSupabaseArtifact(key: string) {
  const settings = config(key);
  const response = await fetch(settings.bucketUrl, {
    method: 'DELETE',
    headers: { ...settings.headers, 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: [key] }),
    signal: AbortSignal.timeout(10_000),
    redirect: 'error',
  });
  if (!response.ok) throw new ExportError('export-storage-unavailable', 503);
  await response.body?.cancel();
}
