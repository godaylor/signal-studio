/* eslint-disable no-console */
import 'dotenv/config';
import { validateProductionEnvironment } from './runtime-config.js';

function checkMissing(vars) {
  const missing = vars.filter(key => !process.env[key]);

  if (missing.length) {
    console.log('The following environment variables are not defined:');
    for (const item of missing) {
      console.log(' - ', item);
    }
    process.exit(1);
  }
}

function checkProductionSecret() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const secret = process.env.APP_SECRET;
  const unsafeValues = new Set([
    'replace-me',
    'replace-me-with-a-random-string',
    'generated-by-pnpm-env-init',
    'changeme',
  ]);

  if (!secret || secret.length < 32 || unsafeValues.has(secret.toLowerCase())) {
    console.error(
      'APP_SECRET must be a non-placeholder secret of at least 32 characters in production.',
    );
    process.exit(1);
  }
}

function checkManagementCors() {
  const origin = process.env.MANAGEMENT_API_ALLOWED_ORIGIN;

  if (!origin) {
    return;
  }

  try {
    if (origin === '*' || new URL(origin).origin !== origin) {
      throw new Error('invalid origin');
    }
  } catch {
    console.error('MANAGEMENT_API_ALLOWED_ORIGIN must be one explicit URL origin, never *');
    process.exit(1);
  }
}

function checkClientIpHeader() {
  const header = process.env.CLIENT_IP_HEADER;

  if (header && !/^[a-z0-9-]+$/i.test(header)) {
    console.error('CLIENT_IP_HEADER must be one HTTP header name set by a trusted proxy.');
    process.exit(1);
  }
}

if (!process.env.SKIP_DB_CHECK && !process.env.DATABASE_TYPE) {
  checkMissing(['DATABASE_URL']);
}

if (process.env.CLOUD_URL) {
  checkMissing(['CLOUD_URL', 'CLICKHOUSE_URL', 'REDIS_URL']);
}

checkProductionSecret();
checkManagementCors();
checkClientIpHeader();
try { validateProductionEnvironment(process.env); }
catch (error) { console.error(error.message); process.exit(1); }
