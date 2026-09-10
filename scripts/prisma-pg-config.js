// Keep the explicit `sslmode=no-verify` compatibility opt-in consistent for
// standalone seed/bootstrap scripts and the application runtime.
export function getPrismaPgConfig(connectionString, options = {}) {
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
