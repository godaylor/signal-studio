/**
 * Build a node-postgres configuration for Prisma's driver adapter.
 *
 * Prisma ORM 7 delegates TLS handling to node-postgres. Some managed Postgres
 * providers expose a certificate chain that is not in the runtime trust store,
 * so an operator may explicitly opt into compatibility mode with
 * `sslmode=no-verify` in DATABASE_URL. Secure/verified connections remain the
 * default for every other mode.
 */
export function getPrismaPgConfig(
  connectionString: string,
  options: Record<string, unknown> = {},
) {
  const url = new URL(connectionString);
  const ssl = url.searchParams.get('sslmode') === 'no-verify'
    ? { rejectUnauthorized: false }
    : undefined;

  return {
    connectionString,
    ...options,
    ...(ssl ? { ssl } : {}),
  };
}
