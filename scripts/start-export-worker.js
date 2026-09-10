import path from 'node:path';
process.env.NODE_ENV = 'production';
await import('./check-env.js');
await import('./check-runtime-db.js');
process.env.EXPORT_STORAGE_PATH = path.resolve(process.env.EXPORT_STORAGE_PATH || '.local/exports');
await import('../generated/export-worker.mjs');
