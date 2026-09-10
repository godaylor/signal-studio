// The standalone server reads NODE_ENV during module initialization. Set it
// here so every canonical `pnpm start` invocation enforces production checks.
import path from 'node:path';
process.env.NODE_ENV = 'production';

await import('./check-env.js');
await import('./check-runtime-db.js');
process.env.EXPORT_STORAGE_PATH = path.resolve(process.env.EXPORT_STORAGE_PATH || '.local/exports');
process.env.HOSTNAME = process.env.SIGNAL_STUDIO_BIND_HOST || '127.0.0.1';
process.env.PORT ||= '32109';
await import('../.next/standalone/server.js');
