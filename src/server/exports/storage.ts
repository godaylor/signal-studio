import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ExportError } from './contracts';
import { readSupabaseArtifact, removeSupabaseArtifact, writeSupabaseArtifact } from './supabase-storage';

const artifactPattern = /^[a-f0-9-]{36}\.[a-f0-9-]{36}\.bin$/;
export const exportDirectory = () =>
  path.resolve(/* turbopackIgnore: true */ process.env.EXPORT_STORAGE_PATH || '.local/exports');
export function artifactPath(key: string) {
  if (!artifactPattern.test(key)) throw new ExportError('export-artifact-invalid');
  return path.join(/* turbopackIgnore: true */ exportDirectory(), key);
}
function encryptionKey() {
  if (!process.env.APP_SECRET || process.env.APP_SECRET.length < 32)
    throw new ExportError('export-secret-not-configured', 503);
  return createHash('sha256')
    .update('signal-studio.export.v1:')
    .update(process.env.APP_SECRET)
    .digest();
}

// Format: 12-byte IV, 16-byte authentication tag, then AES-256-GCM ciphertext.
export async function writeArtifact(key: string, chunks: AsyncIterable<Buffer>) {
  if (process.env.EXPORT_STORAGE_BACKEND === 'supabase') return writeSupabaseArtifact(key, chunks);
  await mkdir(exportDirectory(), { recursive: true, mode: 0o700 });
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const filePath = artifactPath(key);
  const header = await open(/* turbopackIgnore: true */ filePath, 'wx', 0o600);
  try {
    await header.write(Buffer.concat([iv, Buffer.alloc(16)]));
  } finally {
    await header.close();
  }
  try {
    await pipeline(
      Readable.from(chunks),
      cipher,
      createWriteStream(/* turbopackIgnore: true */ filePath, { flags: 'r+', start: 28 }),
    );
    const file = await open(/* turbopackIgnore: true */ filePath, 'r+');
    try {
      await file.write(cipher.getAuthTag(), 0, 16, 12);
    } finally {
      await file.close();
    }
  } catch (error) {
    await removeArtifact(key);
    throw error;
  }
}

export async function readArtifact(key: string): Promise<ReadableStream<Uint8Array>> {
  if (process.env.EXPORT_STORAGE_BACKEND === 'supabase') return readSupabaseArtifact(key);
  const filePath = artifactPath(key);
  const file = await open(/* turbopackIgnore: true */ filePath, 'r').catch(() => {
    throw new ExportError('export-artifact-unavailable', 410);
  });
  const header = Buffer.alloc(28);
  try {
    const read = await file.read(header, 0, 28, 0);
    if (read.bytesRead !== 28) throw new ExportError('export-artifact-invalid', 410);
  } finally {
    await file.close();
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), header.subarray(0, 12));
  decipher.setAuthTag(header.subarray(12, 28));
  const input = createReadStream(/* turbopackIgnore: true */ filePath, { start: 28 });
  input.on('error', error => decipher.destroy(error));
  decipher.on('close', () => input.destroy());
  return Readable.toWeb(input.pipe(decipher)) as ReadableStream<Uint8Array>;
}

export async function removeArtifact(key: string) {
  if (process.env.EXPORT_STORAGE_BACKEND === 'supabase') return removeSupabaseArtifact(key);
  await unlink(/* turbopackIgnore: true */ artifactPath(key)).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
}
