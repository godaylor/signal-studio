import { readFile } from 'node:fs/promises';

export async function lockdownDataApi(client) {
  const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const allowed = new Set([
    '_prisma_migrations',
    ...Array.from(schema.matchAll(/@@map\("([a-z0-9_]+)"\)/g), match => match[1]),
  ]);
  return client.$transaction(async tx => {
    const tables = await tx.$queryRawUnsafe(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    if (
      !tables.some(row => row.tablename === 'export_job') ||
      tables.some(row => !allowed.has(row.tablename))
    )
      throw new Error(
        'Requires a dedicated, migrated Signal Studio database; unknown tables will not be changed.',
      );
    for (const { tablename } of tables) {
      // Identifier is checked against the repository's closed schema mapping above.
      await tx.$executeRawUnsafe(`ALTER TABLE public."${tablename}" ENABLE ROW LEVEL SECURITY`);
    }
    const roles = await tx.$queryRawUnsafe(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')",
    );
    for (const { rolname } of roles) {
      await tx.$executeRawUnsafe(`REVOKE ALL ON SCHEMA public FROM "${rolname}"`);
      await tx.$executeRawUnsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${rolname}"`);
      await tx.$executeRawUnsafe(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "${rolname}"`);
      await tx.$executeRawUnsafe(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM "${rolname}"`,
      );
    }
    const unchecked = await tx.$queryRawUnsafe(
      "SELECT relname FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='public' AND relkind='r' AND NOT relrowsecurity",
    );
    if (unchecked.length) throw new Error('Data API lockdown verification failed.');
    return { protectedTables: tables.length, restrictedRoles: roles.length };
  });
}
