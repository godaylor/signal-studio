import { parseRequest } from '@/lib/request';
import { forbidden, json, serverError } from '@/lib/response';
import { operationSnapshot } from '@/server/operations/telemetry';
import { liveSnapshotService } from '@/server/live/live-snapshot-service';
import { exportDb } from '@/server/exports/database';
export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  // Process-wide metrics must never leak other tenants' usage to project owners.
  if (!auth?.user?.isAdmin) return forbidden({ code: 'operator-access-required' });
  try {
    const jobs = await exportDb.exportJob.groupBy({ by: ['status'], _count: { _all: true } });
    const response = json({ ...operationSnapshot(), live: liveSnapshotService.metrics(), exports: jobs.map(job => ({ status: job.status, count: job._count._all })) });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch { return serverError(); }
}
