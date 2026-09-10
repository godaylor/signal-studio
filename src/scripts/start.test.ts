import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('canonical start rejects a placeholder secret without caller-provided NODE_ENV', () => {
  const environment = {
    ...process.env,
    APP_SECRET: 'generated-by-pnpm-env-init',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/dummy',
  };
  delete environment.NODE_ENV;

  expect(() =>
    execFileSync(process.execPath, ['scripts/start.js'], {
      env: environment,
      stdio: 'pipe',
    }),
  ).toThrow(/APP_SECRET must be a non-placeholder secret/);
});
