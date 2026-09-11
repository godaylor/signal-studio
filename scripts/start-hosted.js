import 'dotenv/config';
import { mkdir, access, chown, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { supervise } from './hosted-supervisor.js';
import { validateProductionEnvironment } from './runtime-config.js';

process.env.NODE_ENV = 'production';
process.env.SIGNAL_STUDIO_BIND_HOST ||= '0.0.0.0';
process.env.PORT ||= '3000';
validateProductionEnvironment(process.env);
if (!process.env.EXPORT_STORAGE_PATH)
  throw new Error('Set EXPORT_STORAGE_PATH to a durable mounted directory.');
await mkdir(process.env.EXPORT_STORAGE_PATH, { recursive: true, mode: 0o700 });
// Railway mounts volumes as root. Only initialize the fixed export mount, then
// irrevocably drop privileges before starting either application process.
if (process.getuid?.() === 0) {
  if (process.env.EXPORT_STORAGE_PATH !== '/app/exports' || (await lstat('/app/exports')).isSymbolicLink()) {
    throw new Error('Root volume initialization is restricted to /app/exports.');
  }
  await chown('/app/exports', 1001, 1001);
  process.setgroups([]);
  process.setgid(1001);
  process.setuid(1001);
}
await access(process.env.EXPORT_STORAGE_PATH, constants.W_OK);
const runtime = supervise([['scripts/start.js'], ['scripts/start-export-worker.js']]);
process.on('SIGTERM', () => runtime.stop());
process.on('SIGINT', () => runtime.stop());
process.exitCode = await runtime.done;
