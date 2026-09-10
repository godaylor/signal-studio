import 'dotenv/config';
import { setTimeout } from 'node:timers/promises';
import prisma from '@/lib/prisma';
import { cleanupExports, runExportOnce } from '@/server/exports/worker';
import { runLifecycleOnce } from '@/server/lifecycle/worker';

let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});

async function main() {
  let lastCleanup = 0;
  do {
    if (Date.now() - lastCleanup > 60_000) {
      await cleanupExports();
      lastCleanup = Date.now();
    }
    const lifecycleWorked = await runLifecycleOnce();
    const worked = (await runExportOnce()) || lifecycleWorked;
    if (process.argv.includes('--once')) break;
    if (!worked && !stopping) await setTimeout(2_000);
  } while (!stopping);
}

main()
  .catch(() => {
    console.error(JSON.stringify({ event: 'export.worker', code: 'worker-unavailable' }));
    process.exitCode = 1;
  })
  .finally(() => prisma.client.$disconnect());
