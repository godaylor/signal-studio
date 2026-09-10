import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { getPrismaPgConfig } from '@/lib/prisma-pg';

const registry = globalThis as typeof globalThis & { signalStudioLifecycleLocks?: PrismaClient };
function lockDatabase() {
  if (!registry.signalStudioLifecycleLocks) {
    const url = new URL(process.env.DATABASE_URL!);
    registry.signalStudioLifecycleLocks = new PrismaClient({ adapter: new PrismaPg(getPrismaPgConfig(url.toString(), {
      max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
      application_name: 'signal-studio-ingestion-locks',
    }), { schema: url.searchParams.get('schema') ?? 'public' }) });
  }
  return registry.signalStudioLifecycleLocks;
}
export async function disconnectLifecycleLocks() {
  await registry.signalStudioLifecycleLocks?.$disconnect();
  delete registry.signalStudioLifecycleLocks;
}

// Shared advisory lock spans the complete accepted write. The lifecycle worker
// takes its exclusive counterpart, so pre-existing ingestion finishes first.
export async function withLifecycleIngestion(
  projectId: string | undefined,
  action: () => Promise<Response>,
) {
  if (!projectId) return action();
  // Lock-only connections are bounded separately: accepted writes use the normal
  // query pool and cannot deadlock behind other requests holding its connections.
  return lockDatabase().$transaction(
    async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${`lifecycle:${projectId}`}))::text`;
      const jobs = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM data_lifecycle_job WHERE project_id=${projectId}::uuid AND status IN ('queued','running') LIMIT 1`;
      if (jobs.length)
        return Response.json(
          { error: { code: 'source-maintenance' } },
          { status: 503, headers: { 'retry-after': '30', 'access-control-allow-origin': '*' } },
        );
      return action();
    },
    { timeout: 240_000, maxWait: 5_000 },
  );
}
