import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client.js';

const legacyId = '41e2b680-648e-4b09-bcd7-3e2b10c06264';
export const disabledDemoPassword = '!'.repeat(60);

export async function bootstrapAdmin(client, username, password) {
  username = username?.trim().toLowerCase();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$/.test(username ?? '') || username.toLowerCase() === 'admin') throw new Error('Choose a non-demo administrator username (3–80 letters/digits/._-).');
  if (typeof password !== 'string' || password.length < 20 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Administrator password must contain 20–72 UTF-8 bytes.');
  return client.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(1660944384)::text`;
    const existing = await tx.user.findUnique({ where: { username } });
    if (existing) {
      if (existing.role === 'admin' && !existing.deletedAt && await bcrypt.compare(password, existing.password)) return { id: existing.id, created: false };
      throw new Error('Administrator already exists; bootstrap will not overwrite credentials.');
    }
    const activeAdmin = await tx.user.findFirst({ where: { role: 'admin', deletedAt: null, NOT: { id: legacyId, password: disabledDemoPassword } } });
    if (activeAdmin) throw new Error('An administrator already exists. Use authenticated account management.');
    const legacy = await tx.user.findUnique({ where: { id: legacyId } });
    const passwordHash = await bcrypt.hash(password, 12);
    const data = { username, password: passwordHash, role: 'admin', deletedAt: null };
    const user = legacy?.password === disabledDemoPassword
      ? await tx.user.update({ where: { id: legacyId }, data: { ...data, sessionVersion: { increment: 1 } } })
      : await tx.user.create({ data: { id: randomUUID(), ...data } });
    await tx.securityAuditEvent.create({ data: { id: randomUUID(), actorUserId: user.id, eventType: 'administrator.bootstrapped', outcome: 'success', metadata: { preservedLegacyOwnership: user.id === legacyId } } });
    return { id: user.id, created: true };
  }, { timeout: 15_000 });
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  let username = process.env.BOOTSTRAP_ADMIN_USERNAME;
  let password = process.env.BOOTSTRAP_ADMIN_PASSWORD_FILE ? (await readFile(process.env.BOOTSTRAP_ADMIN_PASSWORD_FILE, 'utf8')).trim() : process.env.BOOTSTRAP_ADMIN_PASSWORD;
  let credentialsPath;
  if (process.argv.includes('--local')) {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('--local is restricted to a localhost database.');
    credentialsPath = path.resolve(process.env.BOOTSTRAP_CREDENTIALS_FILE || '.local/credentials/administrator.json');
    const scope = `${url.host}${url.pathname}`;
    let credentials;
    try { credentials = JSON.parse(await readFile(credentialsPath, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      credentials = { database: scope, username: username || 'signal-owner', password: randomBytes(36).toString('base64url') };
      await mkdir(path.dirname(credentialsPath), { recursive: true, mode: 0o700 });
      await writeFile(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    }
    if (credentials.database !== scope) throw new Error('This credentials file belongs to another database. Select a separate local credentials file.');
    ({ username, password } = credentials);
  }
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }, { schema: url.searchParams.get('schema') }) });
  try {
    const result = await bootstrapAdmin(client, username, password);
    console.log(`Administrator ${result.created ? 'initialized' : 'already initialized'}: ${username}`);
    if (credentialsPath) console.log(`Credentials are stored locally (not printed): ${credentialsPath}`);
  } finally { await client.$disconnect(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  console.error('Administrator bootstrap failed. Check migration 34, username/password requirements, credentials file scope, and whether an administrator already exists. No credentials were printed.');
  process.exitCode = 1;
});
