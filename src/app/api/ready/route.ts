import prisma from '@/lib/prisma';
import { json, serviceUnavailable } from '@/lib/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await prisma.client.$queryRaw<Array<{ version: number; migrated: boolean }>>`SELECT current_setting('server_version_num')::int AS version,
      EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = '35_data_lifecycle' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrated`;
    if (!rows[0]?.migrated || rows[0].version < 150000) {
      return serviceUnavailable({ code: 'database-schema-not-ready', dependencies: { database: 'unavailable' } });
    }

    return json({
      ok: true,
      dependencies: { database: 'ready' },
    });
  } catch {
    return serviceUnavailable({
      code: 'database-unavailable',
      dependencies: { database: 'unavailable' },
    });
  }
}
