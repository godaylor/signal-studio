import { timingSafeEqual } from 'node:crypto';
import { runServerlessJobs } from '@/server/jobs/serverless';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.JOBS_CRON_SECRET;
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  if (
    process.env.SIGNAL_STUDIO_SERVERLESS !== '1' ||
    !secret ||
    secret.length < 32 ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: { code: 'unauthorized' } }, { status: 401 });
  try {
    await runServerlessJobs('cron');
    return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: { code: 'jobs-unavailable' } }, { status: 503 });
  }
}
