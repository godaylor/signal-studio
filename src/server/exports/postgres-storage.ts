import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { getPrismaPgConfig } from '@/lib/prisma-pg';
import { ExportError } from './contracts';

export const POSTGRES_ARTIFACT_BYTES = 3 * 1024 * 1024;
export const POSTGRES_STORAGE_BYTES = 24 * 1024 * 1024;
// A separate single-connection pool avoids waiting on the dataset's open snapshot
// transaction when both Prisma connections are occupied by concurrent exports.
let pool: PrismaClient;
function database() {
  pool ??= new PrismaClient({ adapter: new PrismaPg(getPrismaPgConfig(process.env.DATABASE_URL!, { max: 1, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 })) });
  return pool;
}
function cipherKey(key: string) {
  if (!/^[a-f0-9-]{36}\.[a-f0-9-]{36}\.bin$/.test(key)) throw new ExportError('export-artifact-invalid');
  if (!process.env.APP_SECRET || process.env.APP_SECRET.length < 32) throw new ExportError('export-secret-not-configured', 503);
  return createHash('sha256').update('signal-studio.export.v1:').update(process.env.APP_SECRET).digest();
}

export async function writePostgresArtifact(key: string, chunks: AsyncIterable<Buffer>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cipherKey(key), iv);
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of chunks) {
    size += chunk.length;
    if (size > POSTGRES_ARTIFACT_BYTES) throw new ExportError('export-size-limit', 413);
    parts.push(cipher.update(chunk));
  }
  parts.push(cipher.final());
  const payload = Buffer.concat([iv, cipher.getAuthTag(), ...parts]);
  await database().$transaction(async client => {
    await client.$executeRaw`SET LOCAL statement_timeout = '15s'`;
    // Serialize quota checks across all serverless instances, then use a fresh
    // READ COMMITTED snapshot. Never evict unexpired artifacts to make room.
    await client.$queryRaw`SELECT pg_advisory_xact_lock(1660944385)::text`;
    await client.$executeRaw`DELETE FROM export_artifact WHERE expires_at <= now()`;
    const usage = await client.$queryRaw<Array<{ bytes: string }>>`SELECT COALESCE(sum(octet_length(payload)), 0)::text AS bytes FROM export_artifact`;
    if (Number(usage[0].bytes) + payload.length > POSTGRES_STORAGE_BYTES) throw new ExportError('export-storage-capacity', 413);
    const inserted = await client.$executeRaw`INSERT INTO export_artifact (key, job_id, payload, expires_at)
       SELECT ${key}, id, ${payload}, expires_at FROM export_job
       WHERE artifact_key = ${key} AND status = 'running' AND expires_at > now()`;
    if (inserted !== 1) throw new ExportError('export-artifact-unavailable', 410);
  }, { timeout: 20_000, maxWait: 5_000 });
}

export async function readPostgresArtifact(key: string): Promise<ReadableStream<Uint8Array>> {
  const secret = cipherKey(key);
  const result = await database().$queryRaw<Array<{ payload: Uint8Array }>>`SELECT payload FROM export_artifact WHERE key = ${key} AND expires_at > now()`;
  if (!result[0]) throw new ExportError('export-artifact-unavailable', 410);
  const payload = Buffer.from(result[0].payload);
  if (payload.length < 28 || payload.length > POSTGRES_ARTIFACT_BYTES + 28) throw new ExportError('export-artifact-invalid', 410);
  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', secret, payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    plaintext = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
  } catch { throw new ExportError('export-artifact-invalid', 410); }
  return new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(plaintext)); controller.close(); } });
}

export async function removePostgresArtifact(key: string) {
  cipherKey(key);
  await database().$executeRaw`DELETE FROM export_artifact WHERE key = ${key}`;
}

export async function cleanupPostgresArtifacts() {
  await database().$executeRaw`DELETE FROM export_artifact WHERE expires_at <= now()`;
}
