import { randomUUID } from 'node:crypto';
import { expect, test } from 'vitest';
import { lockdownDataApi } from '../../scripts/supabase-lockdown.js';
import { exportDb as db } from '@/server/exports/database';

test('Data API lockdown enables RLS and even an explicit SELECT grant cannot expose rows', async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.includes('_test_')) throw new Error('Isolated test database required');
  const role = `signal_test_${randomUUID().replaceAll('-', '')}`;
  const before = await db.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='public' AND relkind='r'`;
  if (before.some(table => !/^[a-z0-9_]+$/.test(table.relname))) throw new Error('Unexpected test table identifier');
  let created = false;
  try {
    const result = await lockdownDataApi(db);
    expect(result.protectedTables).toBe(before.length);
    await db.$executeRawUnsafe(`CREATE ROLE "${role}" NOLOGIN`); created = true;
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await db.$executeRawUnsafe(`GRANT SELECT ON public._prisma_migrations TO "${role}"`);
    const rows = await db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      return tx.$queryRaw`SELECT migration_name FROM public._prisma_migrations`;
    });
    expect(rows).toEqual([]);
  } finally {
    if (created) {
      await db.$executeRawUnsafe(`REVOKE SELECT ON public._prisma_migrations FROM "${role}"`);
      await db.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM "${role}"`);
      await db.$executeRawUnsafe(`DROP ROLE "${role}"`);
    }
    for (const table of before.filter(row => !row.relrowsecurity)) {
      await db.$executeRawUnsafe(`ALTER TABLE public."${table.relname}" DISABLE ROW LEVEL SECURITY`);
    }
  }
});
