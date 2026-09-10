export function validateProductionEnvironment(env) {
  if (env.NODE_ENV !== 'production') return;
  const secret = env.APP_SECRET;
  if (!secret || secret.length < 32 || secret === env.DATABASE_URL || /^(.)\1+$/.test(secret) || /^(replace-me|changeme|generated-by-pnpm-env-init)/i.test(secret)) throw new Error('APP_SECRET must be an independent random secret of at least 32 characters.');
  const key = env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!/^[a-f0-9]{64}$/i.test(key ?? '') || /^(.)\1+$/.test(key)) throw new Error('TWO_FACTOR_ENCRYPTION_KEY must be a random 32-byte hexadecimal key.');
  if (!env.DATABASE_URL || !['postgres:', 'postgresql:'].includes(new URL(env.DATABASE_URL).protocol)) throw new Error('A PostgreSQL DATABASE_URL is required.');
  for (const name of ['CLOUD_MODE', 'CLOUD_URL', 'CLICKHOUSE_URL', 'KAFKA_URL', 'DATABASE_REPLICA_URL']) {
    if (env[name]) throw new Error(`${name} is not enabled in the verified PostgreSQL portfolio runtime.`);
  }
  if (env.DATABASE_TYPE && env.DATABASE_TYPE !== 'postgresql') throw new Error('Only the PostgreSQL adapter is release-verified.');
  if (env.SIGNAL_STUDIO_PUBLIC_URL) {
    const url = new URL(env.SIGNAL_STUDIO_PUBLIC_URL);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))) throw new Error('SIGNAL_STUDIO_PUBLIC_URL requires HTTPS, except for localhost development.');
  }
}
