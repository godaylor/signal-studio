import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client.js';
import { getPrismaPgConfig } from './prisma-pg-config.js';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const client = new PrismaClient({ adapter: new PrismaPg(getPrismaPgConfig(url.toString(), { connectionTimeoutMillis: 5000 }), { schema: url.searchParams.get('schema') }) });
  try {
    const rows = await client.$queryRaw`SELECT current_setting('server_version_num')::int AS version, EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = '35_data_lifecycle' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrated`;
    if (rows[0]?.version < 150000 || !rows[0]?.migrated) throw new Error('runtime-schema-not-ready');
    const demo = await client.user.findUnique({ where: { username: 'admin' }, select: { password: true, deletedAt: true } });
    if (demo && !demo.deletedAt && await bcrypt.compare('umami', demo.password)) throw new Error('demo-credentials-active');
  } finally { await client.$disconnect(); }
}

await main().catch(() => {
  console.error('Runtime database preflight failed. Require PostgreSQL 15+, apply migrations explicitly, and disable demo credentials before starting.');
  process.exit(1);
});
