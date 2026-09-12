import { after } from 'next/server';
import { cleanupExports, runExportOnce } from '@/server/exports/worker';
import { runLifecycleOnce } from '@/server/lifecycle/worker';

export async function runServerlessJobs(mode: 'export' | 'lifecycle' | 'cron', jobId?: string) {
  const started = Date.now();
  if (mode === 'cron') await cleanupExports(new Date(), 2);
  if (mode !== 'export') {
    for (let step = 0; step < 20 && Date.now() - started < 30_000; step++) {
      if (!(await runLifecycleOnce())) break;
    }
  }
  if (mode !== 'lifecycle') await runExportOnce(jobId);
  console.info(
    JSON.stringify({
      event: 'jobs.serverless',
      mode,
      durationMs: Date.now() - started,
      outcome: 'success',
    }),
  );
}

export function scheduleServerlessJobs(mode: 'export' | 'lifecycle', jobId?: string) {
  if (process.env.SIGNAL_STUDIO_SERVERLESS !== '1') return;
  after(async () => {
    try {
      await runServerlessJobs(mode, jobId);
    } catch {
      console.error(JSON.stringify({ event: 'jobs.serverless', mode, outcome: 'failed' }));
    }
  });
}
