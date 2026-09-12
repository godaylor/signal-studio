import { randomBytes } from 'node:crypto';
import { expect, test } from 'vitest';
import { validateProductionEnvironment } from '../../../scripts/runtime-config.js';

const valid = () => ({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://user:pass@db:5432/studio', APP_SECRET: randomBytes(36).toString('base64url'), TWO_FACTOR_ENCRYPTION_KEY: randomBytes(32).toString('hex') });
test('validates independent secrets and PostgreSQL runtime', () => { expect(() => validateProductionEnvironment(valid())).not.toThrow(); });
test('rejects database URL fallback for APP_SECRET', () => { const env = valid(); expect(() => validateProductionEnvironment({ ...env, APP_SECRET: env.DATABASE_URL })).toThrow(/independent/); });
test.each(['', '0'.repeat(64), 'invalid'])('rejects invalid 2FA encryption key', key => { expect(() => validateProductionEnvironment({ ...valid(), TWO_FACTOR_ENCRYPTION_KEY: key })).toThrow(/TWO_FACTOR/); });
test.each(['CLOUD_MODE', 'CLOUD_URL', 'CLICKHOUSE_URL', 'KAFKA_URL', 'DATABASE_REPLICA_URL'])('rejects unverified adapter setting %s', name => { expect(() => validateProductionEnvironment({ ...valid(), [name]: 'enabled' })).toThrow(/not enabled/); });
test('requires HTTPS outside loopback', () => { expect(() => validateProductionEnvironment({ ...valid(), SIGNAL_STUDIO_PUBLIC_URL: 'http://example.com' })).toThrow(/HTTPS/); expect(() => validateProductionEnvironment({ ...valid(), SIGNAL_STUDIO_PUBLIC_URL: 'http://127.0.0.1:32109' })).not.toThrow(); });
test('serverless profile fails closed without remote storage and independent cron secret', () => {
  const env = { ...valid(), SIGNAL_STUDIO_SERVERLESS: '1', EXPORT_STORAGE_BACKEND: 'supabase', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', JOBS_CRON_SECRET: randomBytes(32).toString('hex') };
  expect(() => validateProductionEnvironment(env)).not.toThrow();
  expect(() => validateProductionEnvironment({ ...env, EXPORT_STORAGE_BACKEND: 'local' })).toThrow(/Storage/);
  expect(() => validateProductionEnvironment({ ...env, JOBS_CRON_SECRET: env.APP_SECRET })).toThrow(/independent/);
});
